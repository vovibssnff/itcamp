"""Физические примитивы модели L1.

Все контролируемые величины процесса (давления, уровни, температуры) сведены
к одному классу — :class:`ControlLoop`: ПИ-регулятор держит PV у уставки,
воздействуя на «выход» (клапан/расход/топливо) в пределах [out_min, out_max];
внешнее возмущение (`disturbance`) — это и есть физика: тепловой приток,
недостаточная конденсация, потеря сырья и т.д. При исправном контуре ПИ-
регулятор компенсирует возмущение и PV держится у уставки (интегральная
составляющая обнуляет статическую ошибку). Когда модуль возмущения превышает
располагаемую мощность контура (`gain * (out_max - out_min)`), регулятор
насыщается и PV начинает уходить — ровно то поведение, которое описано в
разделе 3 регламента и в докс-сценариях («ранние признаки» → рост/падение
параметра, несмотря на автоматику).

Печи — частный случай: температура на выходе зависит от отношения
топливо/расход, поэтому COT реализована отдельным классом :class:`FurnaceLoop`,
но топливный контур внутри неё — тот же :class:`ControlLoop`.

Обоснование см. README, ADR-СЕ-01/02.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from ..domain.enums import ControllerMode, EquipmentState


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


@dataclass
class ControlLoop:
    """Обобщённый контур: ПИ-регулятор + инерционный процесс 1-го порядка.

    ``pv``           — текущее значение регулируемой величины (давление,
                        уровень, температура — единицы те же, что у тега).
    ``setpoint``      — уставка контура.
    ``gain``          — во сколько единиц PV переводится 100 % хода выхода
                        (или единица возмущения) в установившемся режиме.
    ``tau_s``         — постоянная времени процесса, с.
    ``disturbance``   — внешнее возмущение на этот тик; выставляется сетью
                        (faults/engine.py, физические связи в network.py)
                        заново на каждом тике, само по себе не запоминается.
    """

    tag_id: str
    pv: float
    setpoint: float
    kp: float
    ki: float
    out_min: float
    out_max: float
    gain: float
    tau_s: float
    #: PV, к которому стремится процесс при output=0 и disturbance=0 —
    #: то есть номинальная рабочая точка. Без этого слагаемого контур не
    #: может достичь уставки, если она не равна нулю (см. README, ADR-СЕ-02):
    #: ``output``/``gain`` отвечают только за отработку возмущения, не за
    #: выход на саму уставку. По умолчанию равен ``setpoint`` — тогда при
    #: старте (output=0, disturbance=0) PV уже находится в равновесии и нет
    #: паразитного переходного процесса на нулевом тике.
    baseline: float = 0.0
    mode: ControllerMode = ControllerMode.AUTO
    manual_output: float = 0.0
    output: float = 0.0
    disturbance: float = field(default=0.0, repr=False)
    _integral: float = field(default=0.0, init=False, repr=False)

    def _controller_output(self, dt_s: float) -> float:
        if self.mode == ControllerMode.MANUAL:
            return _clamp(self.manual_output, self.out_min, self.out_max)
        error = self.setpoint - self.pv
        candidate_integral = self._integral + error * dt_s
        raw = self.kp * error + self.ki * candidate_integral
        out = _clamp(raw, self.out_min, self.out_max)
        # Анти-windup: не копим интеграл, если выход всё равно насыщен.
        if out == raw:
            self._integral = candidate_integral
        return out

    def step(self, dt_s: float) -> None:
        self.output = self._controller_output(dt_s)
        target = self.baseline + self.gain * self.output + self.disturbance
        self.pv += (target - self.pv) / self.tau_s * dt_s

    def seed_steady_state(self, output: float) -> None:
        """«Безударная» инициализация: выставляет ``output`` и подкручивает
        интеграл так, чтобы первый же вызов ``step()`` воспроизвёл то же
        значение (при нулевой ошибке) — без этого контур в момент t=0
        стартует с output=0 и «проваливается», пока интеграл не накопится
        (см. README, ADR-СЕ-02). Используется для контуров без ``baseline``
        (расходные контуры, где output — это сама величина, а не поправка).
        """
        self.output = output
        self._integral = output / self.ki if self.ki else 0.0

    def set_mode(self, mode: ControllerMode) -> None:
        self.mode = mode
        if mode == ControllerMode.MANUAL:
            self.manual_output = self.output

    def force_output(self, value: float) -> None:
        """Используется блокировками ПАЗ: жёстко фиксирует выход (напр. отсечка топлива)."""
        clamped = _clamp(value, self.out_min, self.out_max)
        self.mode = ControllerMode.MANUAL
        self.manual_output = clamped
        self.output = clamped
        # Сбрасываем интеграл, иначе при возврате в AUTO возможен «пинок».
        self._integral = clamped / self.ki if self.ki else 0.0


@dataclass
class FurnaceLoop:
    """Печь: расходный контур (насос/регулятор потока) + температурный.

    COT стремится к ``base_temp_in + k_duty * fuel_output / max(flow, flow_floor)``
    — здесь напрямую видна физика докс-сценариев 2.1/3.1: падение расхода при
    неизменном топливе поднимает COT, потому что делитель уменьшается.
    """

    furnace_id: str
    flow: ControlLoop
    temp_tag_id: str
    cot: float
    fuel: ControlLoop
    base_temp_in: float
    k_duty: float
    tau_t_s: float
    flow_floor: float

    def step(self, dt_s: float) -> None:
        self.flow.step(dt_s)
        # Топливный контур регулирует по ошибке COT, а не по своему pv —
        # синхронизируем перед вызовом контроллера.
        self.fuel.pv = self.cot
        self.fuel.step(dt_s)
        flow_eff = max(self.flow.pv, self.flow_floor)
        target = self.base_temp_in + self.k_duty * self.fuel.output / flow_eff
        target += self.fuel.disturbance
        self.cot += (target - self.cot) / self.tau_t_s * dt_s


@dataclass
class Pump:
    pump_id: str
    tag_id: str
    nominal_flow_m3h: float
    state: EquipmentState = EquipmentState.RUNNING
    flow_multiplier: float = 1.0

    @property
    def flow_m3h(self) -> float:
        if self.state != EquipmentState.RUNNING:
            return 0.0
        return self.nominal_flow_m3h * max(0.0, self.flow_multiplier)

    def start(self) -> bool:
        if self.state == EquipmentState.TRIPPED:
            return False
        self.state = EquipmentState.RUNNING
        return True

    def stop(self) -> None:
        self.state = EquipmentState.STOPPED

    def trip(self) -> None:
        self.state = EquipmentState.TRIPPED


@dataclass
class InstrumentAirBuffer:
    """Буферная ёмкость воздуха КИП (А-6): часовой запас, разд. 7.9.6.

    Пока ``supply_ok`` — запас держится полным. При потере питания запас
    линейно расходуется; когда он обнуляется — срабатывает fail-safe
    (см. faults/engine.py и physics/interlocks.py: эффект ``IA_FAILSAFE``).
    """

    tag_id: str
    capacity_s: float
    remaining_s: float
    supply_ok: bool = True
    consumption_rate: float = 1.0

    def step(self, dt_s: float) -> None:
        if self.supply_ok:
            self.remaining_s = min(self.capacity_s, self.remaining_s + dt_s)
        else:
            self.remaining_s = max(0.0, self.remaining_s - dt_s * self.consumption_rate)

    @property
    def pct(self) -> float:
        return 100.0 * self.remaining_s / self.capacity_s


@dataclass
class AssistPoint:
    """Второстепенный «рычаг» оператора (реальный или синтетический тег),
    который сетевые связи (network.py) подмешивают в возмущение целевого
    контура. Не имеет собственной динамики — просто удерживаемое значение.
    """

    tag_id: str
    nominal: float
    current: float
    lo: float
    hi: float

    def set_value(self, value: float) -> None:
        self.current = _clamp(value, self.lo, self.hi)

    def reset(self) -> None:
        self.current = self.nominal

    @property
    def deviation(self) -> float:
        return self.current - self.nominal
