"""Сессия моделирования: состояние одной «виртуальной» установки.

По архитектуре (§6.7, ARCH-08) 1 сессия = 1 изолированный инстанс
sim-worker; здесь это ``SimSession`` — полностью независимый объект
(своя сеть, свой ГПСЧ, свой каталог активных неисправностей). В прототипе
несколько сессий могут жить в одном процессе; в target — один под на сессию.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

from ..domain.models import ProcessState, Tag
from ..faults.engine import FaultInjector
from ..physics.interlocks import InterlockState
from ..physics.network import Network


@dataclass
class SimSession:
    session_id: str
    network: Network
    tags: dict[str, Tag]
    fault_injector: FaultInjector = field(default_factory=FaultInjector)
    interlock_state: InterlockState = field(
        default_factory=lambda: InterlockState(active_alarms={}, tripped=set())
    )
    rng: random.Random = field(default_factory=random.Random)
    model_time_s: float = 0.0
    speed: float = 1.0
    seed: int = 0

    def to_process_state(self) -> ProcessState:
        return ProcessState(
            model_time_s=self.model_time_s,
            tag_values=self.network.tag_values(),
            equipment_states=self.network.equipment_states(),
            controller_modes=self.network.controller_modes(),
            active_alarms=dict(self.interlock_state.active_alarms),
            active_faults=list(self.fault_injector.active.keys()),
            tripped_interlocks=sorted(self.interlock_state.tripped),
        )
