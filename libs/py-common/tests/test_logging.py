import json
import logging

from py_common.logging import JsonFormatter, configure_logging, set_request_id


def test_json_formatter_emits_valid_json():
    fmt = JsonFormatter(service_name="auth")
    record = logging.LogRecord(
        name="test", level=logging.INFO, pathname=__file__, lineno=1,
        msg="hello %s", args=("world",), exc_info=None,
    )
    line = fmt.format(record)
    data = json.loads(line)
    assert data["message"] == "hello world"
    assert data["service"] == "auth"
    assert data["level"] == "INFO"
    assert "ts" in data


def test_request_id_in_log():
    set_request_id("req-123")
    fmt = JsonFormatter(service_name="gw")
    record = logging.LogRecord(
        name="t", level=logging.WARNING, pathname=__file__, lineno=1,
        msg="x", args=(), exc_info=None,
    )
    data = json.loads(fmt.format(record))
    assert data["request_id"] == "req-123"
    set_request_id(None)


def test_configure_logging_sets_single_handler():
    root = configure_logging("constructor", "DEBUG")
    assert len(root.handlers) == 1
    assert root.level == logging.DEBUG
