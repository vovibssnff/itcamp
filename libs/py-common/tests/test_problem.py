import json
from pathlib import Path

from jsonschema import Draft202012Validator

from py_common.problem import Problem, problem_dict

SCHEMA = json.loads(
    (Path(__file__).resolve().parents[3] / "schemas" / "error.json").read_text(encoding="utf-8")
)


def test_problem_dict_matches_error_schema():
    body = problem_dict(
        status=422,
        title="Validation failed",
        detail="port type mismatch",
        instance="/api/v1/templates/42/validate",
        errors=[{"field": "edges[3]", "code": "PORT_TYPE_MISMATCH"}],
    )
    Draft202012Validator(SCHEMA).validate(body)
    assert body["status"] == 422
    assert body["type"] == "about:blank"


def test_problem_exception_to_dict():
    exc = Problem(status=403, title="Forbidden", detail="role operator")
    body = exc.to_dict()
    Draft202012Validator(SCHEMA).validate(body)
    assert body["status"] == 403
