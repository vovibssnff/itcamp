"""Фикс.-шаговый интегратор тик-цикла (явный метод Эйлера с подшагами).

Единственное место, где используется numpy — вычисление числа подшагов
(архитектура требует «Python + NumPy/SciPy»; ядро физики намеренно на
stdlib, см. README ADR-СЕ-01). При ``set_speed`` до 10× шаг между вызовами
``step()`` со стороны Model API может быть большим — чтобы контуры с малой
постоянной времени (расходные, ~60 с) оставались устойчивыми, шаг дробится
на подшаги не крупнее ``MAX_SUBSTEP_S``.
"""
from __future__ import annotations

import numpy as np

from ..faults.engine import FaultInjector
from ..physics.network import Network

MAX_SUBSTEP_S = 2.0


def advance(
    network: Network,
    fault_injector: FaultInjector,
    model_time_s: float,
    dt_s: float,
) -> float:
    if dt_s <= 0:
        return model_time_s

    n_substeps = int(np.ceil(dt_s / MAX_SUBSTEP_S))
    n_substeps = max(1, n_substeps)
    sub_dt = dt_s / n_substeps

    t = model_time_s
    for _ in range(n_substeps):
        t += sub_dt
        _tick(network, fault_injector, t, sub_dt)
    return t


def _tick(network: Network, fault_injector: FaultInjector, t: float, sub_dt: float) -> None:
    def apply_faults(net: Network) -> None:
        fault_injector.apply(net, t)

    network.step(sub_dt, apply_faults=apply_faults)
