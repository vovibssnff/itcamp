"""Model API — фасад runtime ``sim-worker`` (§6.7, §7 ARCHITECTURE):
``step``, ``get_state``, ``set_state``, ``inject_fault``, ``set_speed``.
Плюс ``command`` — приём команд оператора через orchestrator.
Жизненный цикл инстанса (create/stop пода) — у ``sim-manager`` (Control API).
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

from ..domain.enums import CommandType, ControllerMode
from ..domain.models import FaultDef, FaultInstance, OperatorCommand, ProcessState, StepResult, Tag
from ..faults.engine import FaultInjector
from ..physics import interlocks
from ..physics.interlocks import InterlockState
from ..physics.network import build_network
from . import integrator
from .session import SimSession

DEFAULT_SPEED_RANGE = (0.1, 10.0)


class UnknownSessionError(KeyError):
    pass


class CommandRejected(Exception):
    pass


@dataclass
class SimulationEngine:
    """Держит все активные сессии в памяти процесса (без внешнего хранилища —
    персистентность снапшотов, если понадобится, остаётся за Snapshot Service,
    архитектура §6.9; этот сервис отдаёт/принимает состояние через set_state).
    """

    template: dict
    tags: dict[str, Tag]
    faults_catalog: dict[str, FaultDef]
    sessions: dict[str, SimSession] = field(default_factory=dict)

    # -- жизненный цикл сессии --------------------------------------------

    def create_session(self, session_id: str, seed: int = 0) -> ProcessState:
        network = build_network(self.template, seed)
        session = SimSession(
            session_id=session_id,
            network=network,
            tags=self.tags,
            fault_injector=FaultInjector(),
            interlock_state=InterlockState(active_alarms={}, tripped=set()),
            rng=random.Random(seed),
            seed=seed,
        )
        self.sessions[session_id] = session
        return session.to_process_state()

    def destroy_session(self, session_id: str) -> None:
        self.sessions.pop(session_id, None)

    def _get(self, session_id: str) -> SimSession:
        session = self.sessions.get(session_id)
        if session is None:
            raise UnknownSessionError(session_id)
        return session

    # -- Model API ----------------------------------------------------------

    def get_state(self, session_id: str) -> ProcessState:
        return self._get(session_id).to_process_state()

    def set_state(
        self,
        session_id: str,
        tag_overrides: dict[str, float] | None = None,
        internal_state: dict | None = None,
        model_time_s: float | None = None,
    ) -> ProcessState:
        """Инициализация/восстановление состояния.

        ``internal_state`` — полный снимок (см. Network.export_internal) для
        точного restore (снапшот); ``tag_overrides`` — точечная правка PV/SP
        конкретных тегов при инициализации сессии из шаблона установки.
        """
        session = self._get(session_id)
        if internal_state is not None:
            session.network.import_internal(internal_state)
        if tag_overrides:
            for tag_id, value in tag_overrides.items():
                loop = session.network.loops.get(tag_id)
                if loop is not None:
                    loop.pv = value
                    loop.setpoint = value
                    continue
                for f in session.network.furnaces.values():
                    if f.temp_tag_id == tag_id:
                        f.cot = value
                        break
        if model_time_s is not None:
            session.model_time_s = model_time_s
        return session.to_process_state()

    def step(self, session_id: str, real_dt_s: float = 1.0) -> StepResult:
        session = self._get(session_id)
        model_dt = real_dt_s * session.speed
        session.model_time_s = integrator.advance(
            session.network, session.fault_injector, session.model_time_s, model_dt
        )

        ia_tripped_before = "IA_FAILSAFE" in session.interlock_state.tripped
        new_alarms, cleared_alarms, new_interlocks = interlocks.evaluate(
            session.tags,
            session.network.tag_values(),
            session.interlock_state,
            session.model_time_s,
            session.network,
            ia_tripped_before,
        )
        for event in new_interlocks:
            session.interlock_state.tripped.add(event.code)
        interlocks.apply_trip_guards(session.network.tag_values(), session.network)

        return StepResult(
            state=session.to_process_state(),
            new_alarms=new_alarms,
            cleared_alarms=cleared_alarms,
            new_interlocks=new_interlocks,
        )

    def inject_fault(
        self, session_id: str, fault_id: str, magnitude: float = 1.0
    ) -> FaultInstance:
        session = self._get(session_id)
        fault_def = self.faults_catalog.get(fault_id)
        if fault_def is None:
            raise KeyError(f"Неизвестная неисправность: {fault_id}")
        return session.fault_injector.inject(fault_def, session.model_time_s, magnitude)

    def clear_fault(self, session_id: str, fault_id: str) -> bool:
        return self._get(session_id).fault_injector.clear(fault_id)

    def set_speed(self, session_id: str, multiplier: float) -> float:
        lo, hi = DEFAULT_SPEED_RANGE
        session = self._get(session_id)
        session.speed = max(lo, min(hi, multiplier))
        return session.speed

    # -- команды оператора ---------------------------------------------------

    def command(self, session_id: str, cmd: OperatorCommand) -> None:
        session = self._get(session_id)
        network = session.network
        kind = cmd.command_type

        if kind == CommandType.SET_SP:
            network.set_setpoint(cmd.target, cmd.value_to or 0.0)
        elif kind == CommandType.SET_OUT:
            network.set_output(cmd.target, cmd.value_to or 0.0)
        elif kind == CommandType.SET_MODE:
            mode = ControllerMode.MANUAL if (cmd.value_to or 0.0) >= 0.5 else ControllerMode.AUTO
            network.set_mode(cmd.target, mode)
        elif kind == CommandType.ACK_ALARM:
            for _key, alarm in session.interlock_state.active_alarms.items():
                if alarm.tag_id == cmd.target and alarm.ack_at_s is None:
                    alarm.ack_at_s = cmd.model_time_s
        elif kind == CommandType.START:
            pump = network.pump_by_tag(cmd.target)
            reason = interlocks.check_start_guard(cmd.target, network.tag_values())
            if reason:
                raise CommandRejected(reason)
            pump.start()
        elif kind == CommandType.STOP:
            network.pump_by_tag(cmd.target).stop()
        elif kind in (CommandType.OPEN, CommandType.CLOSE):
            if cmd.value_to is not None:
                value = cmd.value_to
            else:
                value = 100.0 if kind == CommandType.OPEN else 0.0
            network.set_output(cmd.target, value)
        elif kind == CommandType.ESD:
            for f in network.furnaces.values():
                f.fuel.force_output(0.0)
            for pump in network.pumps.values():
                pump.stop()
        else:
            raise CommandRejected(f"Неподдерживаемый тип команды: {kind}")
