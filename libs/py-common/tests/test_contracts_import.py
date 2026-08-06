"""Проверка, что сгенерированные gRPC-стабы импортируются (plan §10, §16)."""


def test_model_api_stubs_import():
    from ktk_contracts import model_api_pb2, model_api_pb2_grpc

    req = model_api_pb2.CreateSessionRequest(session_id="sess-1", seed=42)
    assert req.session_id == "sess-1"
    assert hasattr(model_api_pb2_grpc, "ModelApiStub")
    assert hasattr(model_api_pb2_grpc, "SimManagerStub")


def test_ai_api_stubs_import():
    from ktk_contracts import ai_api_pb2, ai_api_pb2_grpc

    req = ai_api_pb2.ExplainRequest(session_id="sess-1", model_time=10.0)
    assert req.model_time == 10.0
    assert hasattr(ai_api_pb2_grpc, "AiApiStub")


def test_state_message_fields():
    from ktk_contracts import model_api_pb2

    state = model_api_pb2.State(session_id="s", model_time=1.0, seed=7, schema_version="2.0")
    tag = state.tags.add()
    tag.tag_id = "PRSA-204"
    tag.value = 3.9
    assert state.tags[0].tag_id == "PRSA-204"
    assert state.schema_version == "2.0"
