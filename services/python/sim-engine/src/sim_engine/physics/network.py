"""Топология демо-шаблона: узлы модели L1 и связи между ними.

Граф жёстко «зашит» в коде (а не читается из произвольного JSON-графа
Constructor Service), потому что цель этого сервиса — численная модель
конкретной установки ЭЛОУ-АВТ-4 по регламенту, а не универсальный
интерпретатор графов; общая обвязка (`граф — единица конфигурации», ARCH-07)
остаётся за Constructor Service. Численные параметры (объёмы, номинальные
расходы, коэффициенты контуров) читаются из ``template_atm_demo.json`` —
см. bootstrap.py и README, ADR-СЕ-03.

Ключевое архитектурное решение (README, ADR-СЕ-02): у каждого контролируемого
параметра есть свой ПИ-контур (``ControlLoop``). Неисправность — это либо
- «медленная неисправность» (``disturbance`` выбрана так, что интегральная
  составляющая контура рано или поздно её отрабатывает, но за время
  переходного процесса PV успевает пересечь порог блокировки, если не
  вмешаться быстрее автоматики), либо
- «неисправность недостаточной мощности контура» (``disturbance`` заведомо
  больше располагаемой мощности контура ``gain*out_max`` — самостоятельно
  контур никогда не восстановится, нужны другие узлы — «assist»-точки,
  моделирующие соседнее оборудование: вентиляторы АВЗ, охлаждающую воду,
  орошение, подачу сырья).

Оба механизма используются в докс-сценариях и разведены по группам в
``data/faults_catalog.json``.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..domain.enums import ControllerMode, EquipmentState
from .units import AssistPoint, ControlLoop, FurnaceLoop, InstrumentAirBuffer, Pump

# ---------------------------------------------------------------------------
# Связи «assist-тег -> целевой контур»: см. README ADR-СЕ-02.
# contribution = gain * (assist.current - assist.nominal), суммируется в
# loop.disturbance наряду с вкладом активных неисправностей.
# ---------------------------------------------------------------------------
COUPLINGS: dict[str, tuple[tuple[str, float], ...]] = {
    "PRA 312": (("FRC 404", 0.02), ("FRC 405", 0.02), ("FRC 406", 0.02)),
    "LRCA 641": (("FR 495A", -50.0),),
    "LRCA 640": (("FR 495A", -50.0),),
    "LRCA 639": (("FR 495A", -50.0),),
    "PRSA 204": (("AVZ3_SPEED", -0.018), ("COOLING_WATER_K1", -0.014), ("FRC 408", -0.02)),
    "PRSA 213": (
        ("AVZ45_SPEED", -0.007),
        ("COOLING_WATER_K2", -0.005),
        ("FRC 418", -0.008),
        ("FRC 421", 0.01),
    ),
    "PRCA 220": (
        ("X4_COOLING", -0.02),
        ("FR 415", 0.03),
        ("TRC 5", 0.02),
        ("PRCA 223", -0.02),
    ),
}

#: Постоянная структурная связь: отбор нефти из куба К-1 в печи П-1/П-2/П-3
#: (насосы Н-2, Н-3) снижает уровень К-1 — реальная физика разд. 3, а не
#: эффект неисправности. Приведён в единицах "% уровня на (м3/ч отбора)".
K1_DRAW_COUPLING_PCT_PER_M3H = 0.10


@dataclass
class Network:
    loops: dict[str, ControlLoop]
    furnaces: dict[str, FurnaceLoop]
    pumps: dict[str, Pump]
    assists: dict[str, AssistPoint]
    ia_buffer: InstrumentAirBuffer
    seed: int
    _nominal_furnace_draw_m3h: float = field(init=False, default=0.0)

    def __post_init__(self) -> None:
        self._nominal_furnace_draw_m3h = sum(
            f.flow.setpoint for f in self.furnaces.values()
        )

    # -- реестр «настраиваемых» объектов для faults/engine.py -------------

    def tunable(self, node_id: str) -> Any:
        if node_id in self.loops:
            return self.loops[node_id]
        if node_id in self.furnaces:
            return self.furnaces[node_id]
        if node_id.startswith("flow:"):
            return self.furnaces[node_id.split(":", 1)[1]].flow
        if node_id.startswith("fuel:"):
            return self.furnaces[node_id.split(":", 1)[1]].fuel
        if node_id in self.pumps:
            return self.pumps[node_id]
        if node_id == "IA_BUFFER":
            return self.ia_buffer
        raise KeyError(f"Неизвестный узел модели: {node_id}")

    # -- команды оператора --------------------------------------------------

    def set_setpoint(self, tag_id: str, value: float) -> None:
        if tag_id in self.loops:
            self.loops[tag_id].setpoint = value
            return
        for f in self.furnaces.values():
            if f.flow.tag_id == tag_id:
                f.flow.setpoint = value
                return
            if f.fuel.tag_id == tag_id:
                f.fuel.setpoint = value
                return
        if tag_id in self.assists:
            self.assists[tag_id].set_value(value)
            return
        raise KeyError(f"Тег без уставки/значения: {tag_id}")

    def set_output(self, tag_id: str, value: float) -> None:
        loop = self._find_loop(tag_id)
        loop.manual_output = value
        if loop.mode == ControllerMode.MANUAL:
            loop.output = max(loop.out_min, min(loop.out_max, value))

    def set_mode(self, tag_id: str, mode: ControllerMode) -> None:
        self._find_loop(tag_id).set_mode(mode)

    def _find_loop(self, tag_id: str) -> ControlLoop:
        if tag_id in self.loops:
            return self.loops[tag_id]
        for f in self.furnaces.values():
            if f.flow.tag_id == tag_id:
                return f.flow
            if f.fuel.tag_id == tag_id:
                return f.fuel
        raise KeyError(f"Тег без контура: {tag_id}")

    def pump_by_tag(self, tag_id: str) -> Pump:
        for p in self.pumps.values():
            if p.tag_id == tag_id:
                return p
        raise KeyError(f"Неизвестный насос: {tag_id}")

    # -- тик-цикл -------------------------------------------------------

    def step(self, dt_s: float, apply_faults: Any = None) -> None:
        """``apply_faults(network)``, если задан, вызывается после сброса
        возмущений и до их суммирования по связям — так неисправности
        (faults/engine.py) и связи с соседним оборудованием (COUPLINGS)
        складываются в один и тот же ``disturbance`` контура.
        """
        for loop in self.loops.values():
            loop.disturbance = 0.0
        for f in self.furnaces.values():
            f.flow.disturbance = 0.0
            f.fuel.disturbance = 0.0

        if apply_faults is not None:
            apply_faults(self)

        self._apply_couplings()
        self._apply_pump_effects()

        total_draw = sum(f.flow.pv for f in self.furnaces.values())
        self.loops["LRCA 602"].disturbance += -K1_DRAW_COUPLING_PCT_PER_M3H * (
            total_draw - self._nominal_furnace_draw_m3h
        )

        for loop in self.loops.values():
            loop.step(dt_s)
        for f in self.furnaces.values():
            f.step(dt_s)
        self.ia_buffer.step(dt_s)

    def _apply_couplings(self) -> None:
        for target_tag, links in COUPLINGS.items():
            loop = self.loops.get(target_tag)
            if loop is None:
                continue
            contribution = 0.0
            for assist_tag, gain in links:
                assist = self.assists.get(assist_tag)
                if assist is None:
                    continue
                contribution += gain * assist.deviation
            loop.disturbance += contribution

    def _apply_pump_effects(self) -> None:
        """Stopped pumps must disturb related loops/assists — otherwise START/STOP is cosmetic.

        Mapping follows template_atm_demo equipment roles (сырьё / печи / орошение / мазут).
        Note: FRC 404/405/406 are AssistPoints (operator levers), not ControlLoops.
        """

        def _stopped(tag: str) -> bool:
            for p in self.pumps.values():
                if p.tag_id == tag:
                    return p.state != EquipmentState.RUNNING
            return False

        def _disturb_loop(tag: str, delta: float) -> None:
            loop = self.loops.get(tag)
            if loop is not None:
                loop.disturbance += delta
                return
            for f in self.furnaces.values():
                if f.flow.tag_id == tag:
                    f.flow.disturbance += delta
                    return
                if f.fuel.tag_id == tag:
                    f.fuel.disturbance += delta
                    return

        def _force_assist(tag: str, value: float) -> None:
            assist = self.assists.get(tag)
            if assist is not None:
                assist.set_value(value)

        # Н-1 — сырьевой: без него падают расходы ЭЛОУ / загрузки
        if _stopped("PUMP-N1"):
            for tag in ("FRC 404", "FRC 405", "FRC 406"):
                _force_assist(tag, 5.0)
            _disturb_loop("PRA 312", -3.0)
            for tag in ("LRCA 641", "LRCA 640", "LRCA 639"):
                _disturb_loop(tag, -120.0)

        # Н-20 — подача обессоленной нефти в К-1
        if _stopped("PUMP-N20"):
            _disturb_loop("LRCA 602", -35.0)
            _force_assist("FRC 408", 10.0)

        # Н-2 / Н-3 — подача в атмосферные печи (возмущение > gain*out_max, иначе ПИ компенсирует)
        if _stopped("PUMP-N2"):
            for tag in ("FRCA 411", "FRCA 412", "FRCA 413", "FRCA 414", "FRCA 428"):
                _disturb_loop(tag, -400.0)
        if _stopped("PUMP-N3"):
            for tag in ("FRCA 416", "FRCA 417"):
                _disturb_loop(tag, -400.0)

        # Н-6 — орошение К-1 / сырьё К-4
        if _stopped("PUMP-N6"):
            _force_assist("FRC 408", 5.0)
            _disturb_loop("PRSA 204", 2.5)

        # Н-4 — откачка мазута из К-2
        if _stopped("PUMP-N4"):
            _disturb_loop("LRCA 604", 40.0)
            _disturb_loop("PRSA 213", 1.2)

    # -- снимок тегов -----------------------------------------------------

    def tag_values(self) -> dict[str, float]:
        values: dict[str, float] = {loop.tag_id: loop.pv for loop in self.loops.values()}
        for f in self.furnaces.values():
            values[f.temp_tag_id] = f.cot
            values[f.flow.tag_id] = f.flow.pv
            values[f.fuel.tag_id] = f.fuel.output
        for p in self.pumps.values():
            values[p.tag_id] = 1.0 if p.state == EquipmentState.RUNNING else 0.0
        values[self.ia_buffer.tag_id] = self.ia_buffer.pct
        for a in self.assists.values():
            values[a.tag_id] = a.current
        return values

    def equipment_states(self) -> dict[str, str]:
        return {p.tag_id: p.state.value for p in self.pumps.values()}

    def controller_modes(self) -> dict[str, str]:
        modes = {loop.tag_id: loop.mode.value for loop in self.loops.values()}
        for f in self.furnaces.values():
            modes[f.flow.tag_id] = f.flow.mode.value
            modes[f.fuel.tag_id] = f.fuel.mode.value
        return modes

    def controller_setpoints(self) -> dict[str, float]:
        sps = {loop.tag_id: loop.setpoint for loop in self.loops.values()}
        for f in self.furnaces.values():
            sps[f.flow.tag_id] = f.flow.setpoint
            sps[f.fuel.tag_id] = f.fuel.setpoint
        return sps

    def controller_outputs(self) -> dict[str, float]:
        outs = {loop.tag_id: loop.output for loop in self.loops.values()}
        for f in self.furnaces.values():
            outs[f.flow.tag_id] = f.flow.output
            outs[f.fuel.tag_id] = f.fuel.output
        return outs

    # -- сохранение/восстановление состояния (Model API set_state) ---------

    def export_internal(self) -> dict[str, Any]:
        def loop_state(loop: ControlLoop) -> dict[str, Any]:
            return {
                "pv": loop.pv,
                "setpoint": loop.setpoint,
                "mode": loop.mode.value,
                "manual_output": loop.manual_output,
                "output": loop.output,
                "integral": loop._integral,
            }

        return {
            "loops": {tag_id: loop_state(loop) for tag_id, loop in self.loops.items()},
            "furnaces": {
                fid: {
                    "flow": loop_state(f.flow),
                    "fuel": loop_state(f.fuel),
                    "cot": f.cot,
                }
                for fid, f in self.furnaces.items()
            },
            "pumps": {
                pid: {"state": p.state.value, "flow_multiplier": p.flow_multiplier}
                for pid, p in self.pumps.items()
            },
            "assists": {tag_id: a.current for tag_id, a in self.assists.items()},
            "ia_buffer": {
                "remaining_s": self.ia_buffer.remaining_s,
                "supply_ok": self.ia_buffer.supply_ok,
            },
        }

    def import_internal(self, data: dict[str, Any]) -> None:
        def apply_loop(loop: ControlLoop, saved: dict[str, Any]) -> None:
            loop.pv = saved["pv"]
            loop.setpoint = saved["setpoint"]
            loop.mode = ControllerMode(saved["mode"])
            loop.manual_output = saved["manual_output"]
            loop.output = saved["output"]
            loop._integral = saved["integral"]

        for tag_id, saved in data.get("loops", {}).items():
            if tag_id in self.loops:
                apply_loop(self.loops[tag_id], saved)
        for fid, saved in data.get("furnaces", {}).items():
            f = self.furnaces.get(fid)
            if f is None:
                continue
            apply_loop(f.flow, saved["flow"])
            apply_loop(f.fuel, saved["fuel"])
            f.cot = saved["cot"]
        for pid, saved in data.get("pumps", {}).items():
            p = self.pumps.get(pid)
            if p is None:
                continue
            p.state = EquipmentState(saved["state"])
            p.flow_multiplier = saved["flow_multiplier"]
        for tag_id, value in data.get("assists", {}).items():
            if tag_id in self.assists:
                self.assists[tag_id].current = value
        ia = data.get("ia_buffer")
        if ia:
            self.ia_buffer.remaining_s = ia["remaining_s"]
            self.ia_buffer.supply_ok = ia["supply_ok"]


def build_network(template: dict[str, Any], seed: int = 0) -> Network:
    """Собирает сеть по числовым параметрам из template_*.json.

    Схема секций шаблона: ``loops``, ``furnaces``, ``pumps``, ``assists``,
    ``ia_buffer`` — см. data/template_atm_demo.json и README (раздел
    «Формат шаблона»).
    """
    loops: dict[str, ControlLoop] = {}
    for spec in template.get("loops", []):
        loops[spec["tag_id"]] = ControlLoop(
            tag_id=spec["tag_id"],
            pv=spec["setpoint"],
            setpoint=spec["setpoint"],
            kp=spec["kp"],
            ki=spec["ki"],
            out_min=spec["out_min"],
            out_max=spec["out_max"],
            gain=spec["gain"],
            tau_s=spec["tau_s"],
            baseline=spec["setpoint"],
        )

    furnaces: dict[str, FurnaceLoop] = {}
    for spec in template.get("furnaces", []):
        flow = ControlLoop(
            tag_id=spec["flow_tag"],
            pv=spec["flow_setpoint"],
            setpoint=spec["flow_setpoint"],
            kp=spec["flow_kp"],
            ki=spec["flow_ki"],
            out_min=spec["flow_out_min"],
            out_max=spec["flow_out_max"],
            gain=spec["flow_gain"],
            tau_s=spec["flow_tau_s"],
        )
        # Расходный контур: output — это сама величина расхода (gain=1),
        # а не поправка, поэтому не получает baseline и должен быть
        # инициализирован «безударно» (см. ControlLoop.seed_steady_state).
        flow.seed_steady_state(spec["flow_setpoint"] / spec["flow_gain"])

        fuel = ControlLoop(
            tag_id=spec["fuel_tag"],
            pv=spec["cot_setpoint"],
            setpoint=spec["cot_setpoint"],
            kp=spec["fuel_kp"],
            ki=spec["fuel_ki"],
            out_min=spec["fuel_out_min"],
            out_max=spec["fuel_out_max"],
            gain=1.0,
            tau_s=spec["tau_t_s"],
        )
        flow_nominal = max(spec["flow_setpoint"], spec["flow_floor"])
        fuel_ss = (spec["cot_setpoint"] - spec["base_temp_in"]) * flow_nominal / spec["k_duty"]
        fuel.seed_steady_state(fuel_ss)

        furnaces[spec["id"]] = FurnaceLoop(
            furnace_id=spec["id"],
            flow=flow,
            temp_tag_id=spec["temp_tag"],
            cot=spec["cot_setpoint"],
            fuel=fuel,
            base_temp_in=spec["base_temp_in"],
            k_duty=spec["k_duty"],
            tau_t_s=spec["tau_t_s"],
            flow_floor=spec["flow_floor"],
        )

    pumps: dict[str, Pump] = {
        spec["id"]: Pump(
            pump_id=spec["id"],
            tag_id=spec["tag_id"],
            nominal_flow_m3h=spec["nominal_flow_m3h"],
        )
        for spec in template.get("pumps", [])
    }

    assists: dict[str, AssistPoint] = {
        spec["tag_id"]: AssistPoint(
            tag_id=spec["tag_id"],
            nominal=spec["nominal"],
            current=spec["nominal"],
            lo=spec["lo"],
            hi=spec["hi"],
        )
        for spec in template.get("assists", [])
    }

    ia_spec = template.get("ia_buffer", {"tag_id": "PRA 700", "capacity_s": 3600})
    ia_buffer = InstrumentAirBuffer(
        tag_id=ia_spec["tag_id"],
        capacity_s=ia_spec["capacity_s"],
        remaining_s=ia_spec["capacity_s"],
    )

    return Network(
        loops=loops,
        furnaces=furnaces,
        pumps=pumps,
        assists=assists,
        ia_buffer=ia_buffer,
        seed=seed,
    )
