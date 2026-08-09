"""Демонстрация сквозного сценария без внешних сервисов.

Запуск:
    PYTHONPATH=src python3 scripts/demo.py
    PYTHONPATH=src python3 scripts/demo.py --fault FLT-K1-PRESSURE-HIGH
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from sim_engine.bootstrap import build_application  # noqa: E402
from sim_engine.config import Settings  # noqa: E402
from sim_engine.domain.models import OperatorCommand  # noqa: E402


def rule(title: str) -> None:
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


# Стабилизация по докс-сценарию 4.1: рост давления в К-1.
STABILIZATION_K1 = [
    # Форсировать АВЗ-3 и оборотную воду в Х-1.
    OperatorCommand(0, "SET_SP", "AVZ3_SPEED", value_to=100),
    OperatorCommand(0, "SET_SP", "COOLING_WATER_K1", value_to=450),
    # Увеличить острое орошение FRC 408.
    OperatorCommand(0, "SET_SP", "FRC 408", value_to=70),
]


def run_scenario(fault_id: str, stabilize: bool, horizon_s: int) -> int:
    settings = Settings(data_dir=str(ROOT / "data"))
    app = build_application(settings)
    engine = app.engine

    rule(f"Сессия + инъекция {fault_id}")
    state = engine.create_session("demo-1", seed=42)
    print(f"Шаблон: {app.health()['template_id']}, тегов: {app.health()['tags_loaded']}")
    print(f"t={state.model_time_s:.0f}s  PRSA 204={state.tag_values.get('PRSA 204', 0):.3f}")

    fault = engine.inject_fault("demo-1", fault_id)
    print(f"Неисправность: [{fault.fault_def.docx_ref}] {fault.fault_def.title}")
    print(f"Ранние признаки: {fault.fault_def.early_signs}")

    stabilized = False
    tripped = False
    for t in range(1, horizon_s + 1):
        if stabilize and not stabilized and t == 90:
            rule("Действия оператора (стабилизация по регламенту)")
            for cmd in STABILIZATION_K1:
                cmd_t = OperatorCommand(
                    model_time_s=t,
                    type=cmd.type,
                    target=cmd.target,
                    value_to=cmd.value_to,
                )
                engine.command("demo-1", cmd_t)
                print(f"  t={t}s  {cmd.type} {cmd.target} -> {cmd.value_to}")
            stabilized = True

        result = engine.step("demo-1", real_dt_s=1.0)
        if result.new_alarms:
            for a in result.new_alarms:
                print(
                    f"  t={result.state.model_time_s:.0f}s  ALARM {a.priority} "
                    f"{a.tag_id}={a.value:.3f} (лимит {a.limit})"
                )
        if result.new_interlocks:
            tripped = True
            for e in result.new_interlocks:
                print(
                    f"  t={result.state.model_time_s:.0f}s  INTERLOCK {e.code}: "
                    f"{e.description or e.effects}"
                )

        if t in (60, 120, 180, 240, 300, horizon_s) or (
            result.new_alarms or result.new_interlocks
        ):
            pv = result.state.tag_values
            keys = ("PRSA 204", "LRCA 602", "TR 55-9", "PRA 700", "PRSA 213", "PRCA 220")
            snapshot = "  ".join(
                f"{k}={pv[k]:.2f}" for k in keys if k in pv
            )
            print(f"t={result.state.model_time_s:.0f}s  {snapshot}")

    rule("Итог")
    final = engine.get_state("demo-1")
    print(f"Модельное время: {final.model_time_s:.0f} с")
    print(f"Активные неисправности: {final.active_faults}")
    print(f"Активные алармы: {list(final.active_alarms)}")
    print(f"Сработавшие блокировки: {final.tripped_interlocks}")
    if stabilize:
        print(
            "Стабилизация: "
            + ("успех — блокировка не сработала" if not tripped else "не успели — ПАЗ сработал")
        )
    else:
        print(
            "Без вмешательства: "
            + ("ПАЗ сработал (ожидаемо)" if tripped else "ПАЗ не сработал за горизонт")
        )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Демо sim-worker КТК (Model API)")
    parser.add_argument(
        "--fault",
        default="FLT-K1-PRESSURE-HIGH",
        help="fault_id из data/faults_catalog.json",
    )
    parser.add_argument(
        "--stabilize",
        action="store_true",
        help="на t=90 с выполнить действия стабилизации (для FLT-K1-PRESSURE-HIGH)",
    )
    parser.add_argument("--horizon", type=int, default=360, help="горизонт моделирования, с")
    args = parser.parse_args(argv)
    return run_scenario(args.fault, args.stabilize, args.horizon)


if __name__ == "__main__":
    raise SystemExit(main())
