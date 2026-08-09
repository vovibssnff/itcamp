import unittest

import context  # noqa: F401

from ai_service.bootstrap import load_risk_rules
from ai_service.domain.models import OperatorAction
from ai_service.llm.stub import StubProvider
from ai_service.services.predict_behaviour import BehaviourService, RuleBasedRiskModel


def service(llm=None):
    return BehaviourService(
        model=RuleBasedRiskModel(load_risk_rules(context.DATA / "risk_rules.json")),
        llm=llm or StubProvider(canned="Возможен перегрев труб. Снижайте нагрузку равномерно."),
    )


def action(type_, target, **kw):
    return OperatorAction(model_time_s=100, type=type_, target=target, **kw)


class TestBehaviour(unittest.TestCase):
    def test_furnace_flow_below_min_is_critical(self):
        result = service().assess(action("SET_SP", "FRCA 412", value_from=130, value_to=40))
        self.assertEqual(result.risk_level, "CRITICAL")
        self.assertIn("7.7.1.13", " ".join(result.regulation_refs))
        self.assertTrue(result.detail)

    def test_normal_setpoint_change_is_low_risk(self):
        result = service().assess(action("SET_SP", "FRC 408", value_from=42, value_to=44))
        self.assertEqual(result.risk_level, "LOW")
        self.assertEqual(result.headline, "")

    def test_sharp_reflux_drop_is_high(self):
        result = service().assess(action("SET_SP", "FRC 408", value_from=42, value_to=18))
        self.assertEqual(result.risk_level, "HIGH")

    def test_vsg_below_minimum(self):
        result = service().assess(action("SET_SP", "FQRC 3001", value_from=340, value_to=120))
        self.assertEqual(result.risk_level, "CRITICAL")

    def test_catalyst_overheat(self):
        result = service().assess(action("SET_SP", "TRC 1001", value_from=200, value_to=265))
        self.assertEqual(result.risk_level, "CRITICAL")

    def test_furnace_p3_limit_is_340_not_365(self):
        """Уставка П-3 отличается от П-1/П-2 — частая ошибка в спецификациях."""
        svc = service()
        self.assertEqual(
            svc.assess(action("SET_SP", "TRC 3", value_from=330, value_to=350)).risk_level, "HIGH"
        )
        self.assertEqual(
            svc.assess(action("SET_SP", "TRC 9", value_from=330, value_to=350)).risk_level, "LOW"
        )

    def test_state_condition_required(self):
        svc = service()
        self.assertEqual(
            svc.assess(action("START", "ESD-ELOU"), {"LRCA 641": 4200}).risk_level, "LOW"
        )
        self.assertEqual(
            svc.assess(action("START", "ESD-ELOU"), {"LRCA 641": 3200}).risk_level, "CRITICAL"
        )

    def test_llm_failure_keeps_warning(self):
        """Отказ LLM не лишает оператора предупреждения — заголовок из правила."""
        result = service(llm=StubProvider(fail=True)).assess(
            action("SET_SP", "FRCA 412", value_from=130, value_to=40)
        )
        self.assertEqual(result.risk_level, "CRITICAL")
        self.assertTrue(result.headline)
        self.assertTrue(result.degraded)

    def test_hidden_in_exam(self):
        svc = service()
        result = svc.assess(action("SET_SP", "FRCA 412", value_from=130, value_to=40))
        self.assertFalse(svc.visible_to_operator(result, "EXAM"))
        self.assertTrue(svc.visible_to_operator(result, "TRAINING"))


if __name__ == "__main__":
    unittest.main()
