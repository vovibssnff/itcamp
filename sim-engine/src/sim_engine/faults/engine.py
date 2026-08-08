"""Применение неисправностей к сети (см. README, ADR-СЕ-04).

Неисправность не подменяет модель, а возмущает параметры уже существующей
физической сети: либо суммируется в ``disturbance`` контура (мягкая, в
принципе отрабатываемая регулятором нагрузка — важно, за какое время),
либо переопределяет параметр контура (``out_max``/``out_min``/…) — жёсткое
ограничение располагаемой мощности контура, которое сам контур снять не
может (нужно вмешательство извне: другое оборудование или иной контур).
Оба механизма используются в каталоге неисправностей.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..domain.models import FaultDef, FaultInstance
from ..physics.network import Network


@dataclass
class FaultInjector:
    active: dict[str, FaultInstance] = field(default_factory=dict)
    _baseline: dict[tuple[str, str], float] = field(default_factory=dict, repr=False)

    def inject(
        self, fault_def: FaultDef, model_time_s: float, magnitude: float = 1.0
    ) -> FaultInstance:
        instance = FaultInstance(
            fault_def=fault_def, injected_at_s=model_time_s, magnitude=magnitude
        )
        self.active[fault_def.fault_id] = instance
        return instance

    def clear(self, fault_id: str) -> bool:
        return self.active.pop(fault_id, None) is not None

    def apply(self, network: Network, model_time_s: float) -> None:
        touched: set[tuple[str, str]] = set()
        for instance in self.active.values():
            elapsed = max(0.0, model_time_s - instance.injected_at_s)
            for effect in instance.fault_def.effects:
                obj = network.tunable(effect.node_id)
                progress = 1.0 if effect.ramp_s <= 0 else min(1.0, elapsed / effect.ramp_s)

                if effect.param == "disturbance":
                    delta = effect.target_value * instance.magnitude * progress
                    obj.disturbance = obj.disturbance + delta
                    continue

                key = (effect.node_id, effect.param)
                baseline = self._baseline.setdefault(key, getattr(obj, effect.param))
                if effect.mode == "SET":
                    value = baseline + (effect.target_value - baseline) * progress * instance.magnitude
                elif effect.mode == "MULTIPLY":
                    value = baseline * (1.0 + (effect.target_value - 1.0) * progress * instance.magnitude)
                elif effect.mode == "ADD":
                    value = baseline + effect.target_value * progress * instance.magnitude
                else:
                    raise ValueError(f"Неизвестный режим эффекта неисправности: {effect.mode}")
                setattr(obj, effect.param, value)
                touched.add(key)

        for key in list(self._baseline.keys()):
            if key in touched:
                continue
            node_id, param = key
            try:
                obj = network.tunable(node_id)
            except KeyError:
                continue
            setattr(obj, param, self._baseline[key])
