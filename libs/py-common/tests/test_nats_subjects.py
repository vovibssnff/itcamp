from py_common.nats_helpers import STREAMS, Subjects


def test_subject_catalog():
    assert Subjects.REPORT_TASKS == "report.tasks"
    assert Subjects.AI_TASKS == "ai.tasks"
    assert Subjects.SESSION_EVENTS == "session.events"
    assert Subjects.ai_result("task-9") == "ai.results.task-9"


def test_streams_defined():
    names = {s.name for s in STREAMS}
    assert {"REPORT_TASKS", "AI_TASKS", "AI_RESULTS", "SESSION_EVENTS", "ASSESSMENT_EVENTS"} <= names
    for s in STREAMS:
        assert s.retention in {"workqueue", "interest", "limits"}
