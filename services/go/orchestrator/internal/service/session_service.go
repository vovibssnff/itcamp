package service

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"
	"time"

	"github.com/itcamp/ktc/services/orchestrator/internal/cache"
	"github.com/itcamp/ktc/services/orchestrator/internal/client"
	"github.com/itcamp/ktc/services/orchestrator/internal/domain"
	"github.com/itcamp/ktc/services/orchestrator/internal/events"
	"github.com/itcamp/ktc/services/orchestrator/internal/repository"
	"github.com/itcamp/ktc/shared/go/audit"
)

type TelemetryStore interface {
	SaveTelemetry(ctx context.Context, sessionID string, t domain.Telemetry) error
	GetTelemetry(ctx context.Context, sessionID string) (domain.Telemetry, error)
	DeleteTelemetry(ctx context.Context, sessionID string) error
}

type SessionService struct {
	repo        *repository.SessionRepo
	cache       TelemetryStore
	publisher   *events.Publisher
	sim         client.SimClient
	assessment  client.AssessmentClient
	snapshot    client.SnapshotClient
	scenario    client.ScenarioClient
	constructor client.ConstructorClient
	hub         *WSHub
	log         *slog.Logger

	mu      sync.Mutex
	runners map[string]*SessionRunner
}

func NewSessionService(
	repo *repository.SessionRepo,
	cache *cache.Cache,
	publisher *events.Publisher,
	sim client.SimClient,
	assessment client.AssessmentClient,
	snapshot client.SnapshotClient,
	scenario client.ScenarioClient,
	constructor client.ConstructorClient,
	hub *WSHub,
	log *slog.Logger,
) *SessionService {
	return &SessionService{
		repo: repo, cache: cache, publisher: publisher,
		sim: sim, assessment: assessment, snapshot: snapshot,
		scenario: scenario, constructor: constructor,
		hub: hub, log: log, runners: make(map[string]*SessionRunner),
	}
}

type CreateSessionInput struct {
	TemplateID  string   `json:"template_id"`
	ScenarioID  string   `json:"scenario_id"`
	OperatorIDs []string `json:"operator_ids"`
	Mode        string   `json:"mode"`
	Speed       float64  `json:"speed"`
}

func (s *SessionService) Create(ctx context.Context, instructorID string, in CreateSessionInput) (domain.Session, error) {
	if in.Speed == 0 {
		in.Speed = 1.0
	}
	// Resolve template from scenario when client omits template_id (operators often
	// send only scenario_id; Start requires a template for constructor export).
	if in.TemplateID == "" && in.ScenarioID != "" && s.scenario != nil {
		if raw, err := s.scenario.GetFullScenario(ctx, in.ScenarioID); err == nil {
			var meta struct {
				TemplateID string `json:"template_id"`
			}
			if json.Unmarshal(raw, &meta) == nil && meta.TemplateID != "" {
				in.TemplateID = meta.TemplateID
			}
		}
	}
	sess := domain.Session{
		ID:           newUUID(),
		TemplateID:   in.TemplateID,
		ScenarioID:   in.ScenarioID,
		OperatorIDs:  in.OperatorIDs,
		InstructorID: instructorID,
		Mode:         domain.SessionMode(in.Mode),
		Speed:        in.Speed,
		Status:       domain.StatusCreated,
	}
	if sess.Mode == "" {
		sess.Mode = domain.ModeTraining
	}
	if err := s.repo.Create(ctx, sess); err != nil {
		return domain.Session{}, err
	}
	IncSessionCreated(string(sess.Mode))
	audit.Emit(ctx, s.log, "session.created", "id", sess.ID, "instructor_id", instructorID, "mode", sess.Mode)
	return sess, nil
}

func (s *SessionService) Get(ctx context.Context, id string) (domain.Session, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *SessionService) List(ctx context.Context, status, operatorID string) ([]domain.Session, error) {
	return s.repo.List(ctx, status, operatorID)
}

// LatestTelemetry возвращает последний снимок телеметрии сессии из Radix.
// Используется, чтобы подключившийся WS-клиент мгновенно получил текущее
// состояние процесса, не дожидаясь следующего тика симулятора.
func (s *SessionService) LatestTelemetry(ctx context.Context, sessionID string) (domain.Telemetry, error) {
	return s.cache.GetTelemetry(ctx, sessionID)
}

func (s *SessionService) Start(ctx context.Context, id string) (domain.Session, error) {
	sess, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.Session{}, err
	}
	if sess.Status == domain.StatusRunning || sess.Status == domain.StatusPaused {
		return domain.Session{}, domain.ErrSessionAlreadyRunning
	}
	if sess.Status != domain.StatusCreated {
		return domain.Session{}, domain.ErrSessionNotRunning
	}

	initState, err := s.constructor.ExportTemplate(ctx, sess.TemplateID)
	if err != nil {
		return domain.Session{}, err
	}

	if err := s.sim.CreateSession(ctx, id, initState, 0); err != nil {
		return domain.Session{}, err
	}

	if err := s.sim.SetSpeed(ctx, id, sess.Speed); err != nil {
		return domain.Session{}, err
	}

	if err := s.repo.SetStarted(ctx, id); err != nil {
		return domain.Session{}, err
	}
	IncSessionStarted()

	runner := newSessionRunner(id, sess.ScenarioID, s, s.log)
	if err := runner.loadScenario(ctx); err != nil {
		s.log.WarnContext(ctx, "scenario load for triggers failed", "session", id, "error", err)
	}

	// Preload assessment scoring session (criteria) before ticks/events.
	if err := s.assessment.SendEvent(ctx, id, sess.ScenarioID, "session_start", map[string]any{"mode": sess.Mode, "model_time": sess.ModelTime}); err != nil {
		s.log.WarnContext(ctx, "assessment preload failed", "session", id, "error", err)
	}

	s.mu.Lock()
	s.runners[id] = runner
	s.mu.Unlock()

	// Request ctx is canceled when ServeHTTP returns; runner must outlive the handler.
	go runner.run(context.WithoutCancel(ctx))

	sess.Status = domain.StatusRunning
	_ = s.publisher.PublishSessionEvent(ctx, id, "started", nil)
	audit.Emit(ctx, s.log, "session.started", "id", id)
	return sess, nil
}

func (s *SessionService) Pause(ctx context.Context, id string) (domain.Session, error) {
	s.mu.Lock()
	runner, ok := s.runners[id]
	s.mu.Unlock()
	if ok {
		runner.pause()
	}
	if err := s.repo.UpdateStatus(ctx, id, domain.StatusPaused, 0); err != nil {
		return domain.Session{}, err
	}
	IncSessionPaused()
	_ = s.publisher.PublishSessionEvent(ctx, id, "paused", nil)
	audit.Emit(ctx, s.log, "session.paused", "id", id)
	return s.repo.GetByID(ctx, id)
}

func (s *SessionService) Resume(ctx context.Context, id string) (domain.Session, error) {
	sess, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.Session{}, err
	}
	if sess.Status != domain.StatusPaused {
		return domain.Session{}, domain.ErrSessionNotPaused
	}

	s.mu.Lock()
	runner, ok := s.runners[id]
	s.mu.Unlock()
	if !ok {
		// Process restart or prior request-ctx cancellation dropped the runner.
		runner = newSessionRunner(id, sess.ScenarioID, s, s.log)
		if err := runner.loadScenario(ctx); err != nil {
			s.log.WarnContext(ctx, "scenario load for resume failed", "session", id, "error", err)
		}
		runner.pause()
		s.mu.Lock()
		s.runners[id] = runner
		s.mu.Unlock()
		go runner.run(context.WithoutCancel(ctx))
	}
	runner.resume()

	if err := s.repo.UpdateStatus(ctx, id, domain.StatusRunning, 0); err != nil {
		return domain.Session{}, err
	}
	IncSessionResumed()
	_ = s.publisher.PublishSessionEvent(ctx, id, "resumed", nil)
	audit.Emit(ctx, s.log, "session.resumed", "id", id)
	return s.repo.GetByID(ctx, id)
}

func (s *SessionService) Stop(ctx context.Context, id string) (domain.Session, error) {
	s.mu.Lock()
	runner, ok := s.runners[id]
	delete(s.runners, id)
	s.mu.Unlock()
	if ok {
		runner.stop()
	}

	state, _ := s.sim.GetState(ctx, id)
	modelTime := 0.0
	if state.SessionID != "" {
		modelTime = state.ModelTime
	}

	_ = s.sim.DestroySession(ctx, id)
	if err := s.assessment.Finalize(ctx, id); err != nil {
		s.log.WarnContext(ctx, "assessment finalize failed", "session", id, "error", err)
	}
	_ = s.cache.DeleteTelemetry(ctx, id)

	if err := s.repo.UpdateStatus(ctx, id, domain.StatusStopped, modelTime); err != nil {
		return domain.Session{}, err
	}
	IncSessionStopped()
	_ = s.publisher.PublishSessionEvent(ctx, id, "stopped", nil)
	audit.Emit(ctx, s.log, "session.stopped", "id", id, "model_time", modelTime)
	return s.repo.GetByID(ctx, id)
}

func (s *SessionService) SetSpeed(ctx context.Context, id string, speed float64) (domain.Session, error) {
	if speed < 0.1 || speed > 10 {
		return domain.Session{}, domain.ErrInvalidSpeed
	}
	if err := s.repo.UpdateSpeed(ctx, id, speed); err != nil {
		return domain.Session{}, err
	}
	_ = s.sim.SetSpeed(ctx, id, speed)
	audit.Emit(ctx, s.log, "session.speed_changed", "id", id, "speed", speed)
	return s.repo.GetByID(ctx, id)
}

func (s *SessionService) Checkpoint(ctx context.Context, id, name string) (string, error) {
	state, err := s.sim.GetState(ctx, id)
	if err != nil {
		return "", err
	}
	snapID, _, err := s.snapshot.Save(ctx, id, name, false, state)
	if err != nil {
		return "", err
	}
	IncCheckpointCreated()
	audit.Emit(ctx, s.log, "session.checkpoint_created", "id", id, "snapshot_id", snapID)
	return snapID, nil
}

func (s *SessionService) Restore(ctx context.Context, id, snapshotID, userID string) (domain.Session, error) {
	sess, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return domain.Session{}, err
	}
	if sess.Mode == domain.ModeExam {
		for _, opID := range sess.OperatorIDs {
			if opID == userID {
				return domain.Session{}, domain.ErrExamRestoreForbidden
			}
		}
	}
	state, err := s.snapshot.Restore(ctx, snapshotID)
	if err != nil {
		return domain.Session{}, err
	}
	if err := s.sim.SetState(ctx, id, state); err != nil {
		return domain.Session{}, err
	}
	IncSessionRestored()
	audit.Emit(ctx, s.log, "session.restored", "id", id, "snapshot_id", snapshotID)
	return s.repo.GetByID(ctx, id)
}

func (s *SessionService) HandleActuator(ctx context.Context, id, userID, target string, value any) error {
	sess, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if sess.Status != domain.StatusRunning {
		return domain.ErrSessionNotRunning
	}
	if err := s.sim.SetActuator(ctx, id, target, value); err != nil {
		return err
	}
	action := domain.OperatorAction{
		ID: newUUID(), SessionID: id, UserID: userID,
		Type: "actuator", Target: target, Action: "set", Value: value,
		ModelTime: sess.ModelTime, ServerTime: time.Now().UTC(),
	}
	if err := s.repo.RecordAction(ctx, action); err != nil {
		return err
	}
	IncOperatorAction()
	s.hub.BroadcastOperatorAction(id, action)
	_ = s.assessment.SendEvent(ctx, id, sess.ScenarioID, "action", action)
	_ = s.publisher.PublishSessionEvent(ctx, id, "operator_action", action)
	// Push immediately — don't wait for the next runner tick.
	s.pushAfterCommand(ctx, id, 4)
	return nil
}

// HandleOperatorCommand records and forwards a typed sim command (regulator_*, esd).
func (s *SessionService) HandleOperatorCommand(ctx context.Context, id, userID, cmdType, target string, value any) error {
	sess, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if sess.Status != domain.StatusRunning {
		return domain.ErrSessionNotRunning
	}
	if err := s.sim.Command(ctx, id, cmdType, target, value); err != nil {
		return err
	}
	action := domain.OperatorAction{
		ID: newUUID(), SessionID: id, UserID: userID,
		Type: cmdType, Target: target, Action: "command", Value: value,
		ModelTime: sess.ModelTime, ServerTime: time.Now().UTC(),
	}
	if err := s.repo.RecordAction(ctx, action); err != nil {
		return err
	}
	IncOperatorAction()
	s.hub.BroadcastOperatorAction(id, action)
	_ = s.assessment.SendEvent(ctx, id, sess.ScenarioID, "action", action)
	_ = s.publisher.PublishSessionEvent(ctx, id, "operator_action", action)
	s.pushAfterCommand(ctx, id, 2)
	return nil
}

func (s *SessionService) AckAlarm(ctx context.Context, id, alarmID, userID string) error {
	sess, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	mt := sess.ModelTime
	if err := s.repo.AckAlarm(ctx, alarmID, mt, userID); err != nil {
		return err
	}
	_ = s.assessment.SendEvent(ctx, id, sess.ScenarioID, "alarm_ack", map[string]any{
		"tag_id":     alarmID,
		"model_time": mt,
	})
	s.hub.BroadcastAlarmClear(id, alarmID)
	return nil
}

// pushAfterCommand advances the model a few seconds and broadcasts the live snapshot
// so faceplates/alarms update without waiting for the 250ms runner tick.
func (s *SessionService) pushAfterCommand(ctx context.Context, sessionID string, catchUpSteps int) {
	if catchUpSteps < 1 {
		catchUpSteps = 1
	}
	var state domain.SimState
	var err error
	for i := 0; i < catchUpSteps; i++ {
		state, err = s.lockedStep(ctx, sessionID, 1)
		if err != nil {
			s.log.Warn("post-command sim step failed", "session", sessionID, "error", err)
			return
		}
	}
	s.broadcastSimSnapshot(ctx, sessionID, state)
}

func (s *SessionService) lockedStep(ctx context.Context, sessionID string, dtSec float64) (domain.SimState, error) {
	s.mu.Lock()
	runner := s.runners[sessionID]
	s.mu.Unlock()
	if runner != nil {
		runner.stepMu.Lock()
		defer runner.stepMu.Unlock()
	}
	return s.sim.Step(ctx, sessionID, dtSec)
}

func (s *SessionService) broadcastSimSnapshot(ctx context.Context, sessionID string, state domain.SimState) {
	telemetry := domain.Telemetry{
		ModelTime:  state.ModelTime,
		Tags:       state.Tags,
		Regulators: state.Regulators,
		Alarms:     state.Alarms,
	}
	if s.cache != nil {
		_ = s.cache.SaveTelemetry(ctx, sessionID, telemetry)
	}
	if s.hub == nil {
		return
	}
	s.hub.BroadcastTelemetry(sessionID, tagsForWS(state.Tags, state.ModelTime, state.Alarms))
	for _, reg := range RegulatorsForWS(state.Regulators) {
		s.hub.BroadcastRegulator(sessionID, reg)
	}

	speed := 1.0
	status := string(domain.StatusRunning)
	scenarioID := ""
	if s.repo != nil {
		if sess, err := s.repo.GetByID(ctx, sessionID); err == nil {
			if sess.Speed > 0 {
				speed = sess.Speed
			}
			if sess.Status != "" {
				status = string(sess.Status)
			}
			scenarioID = sess.ScenarioID
		}
		_ = s.repo.UpdateStatus(ctx, sessionID, domain.SessionStatus(status), state.ModelTime)
	}
	s.hub.BroadcastSessionStatus(sessionID, status, state.ModelTime, speed)

	s.mu.Lock()
	runner := s.runners[sessionID]
	s.mu.Unlock()

	announce := state.NewAlarms
	if len(announce) == 0 {
		for _, alarm := range state.Alarms {
			if alarm.AckModelTime == nil {
				announce = append(announce, alarm)
			}
		}
	}
	for _, alarm := range announce {
		if alarm.AckModelTime != nil || alarm.ID == "" {
			continue
		}
		if runner != nil && !runner.markAlarmNew(alarm.ID) {
			continue
		}
		if s.repo != nil {
			_ = s.repo.RecordAlarm(ctx, alarm)
		}
		if s.assessment != nil {
			_ = s.assessment.SendEvent(ctx, sessionID, scenarioID, "alarm", alarm)
		}
		s.hub.BroadcastAlarm(sessionID, alarmForWS(alarm))
	}
	for _, alarm := range state.ClearedAlarms {
		if runner != nil {
			runner.clearKnownAlarm(alarm.ID)
		}
		if alarm.ID != "" {
			s.hub.BroadcastAlarmClear(sessionID, alarm.ID)
		}
	}
}

type SessionRunner struct {
	sessionID   string
	scenarioID  string
	svc         *SessionService
	log         *slog.Logger
	engine      *TriggerEngine
	paused      bool
	stopped     bool
	failCount   int
	knownAlarms map[string]bool
	mu          sync.Mutex
	stepMu      sync.Mutex
}

func newSessionRunner(sessionID, scenarioID string, svc *SessionService, log *slog.Logger) *SessionRunner {
	return &SessionRunner{
		sessionID:   sessionID,
		scenarioID:  scenarioID,
		svc:         svc,
		log:         log,
		engine:      NewTriggerEngine(log),
		knownAlarms: make(map[string]bool),
	}
}

func (r *SessionRunner) markAlarmNew(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.knownAlarms[id] {
		return false
	}
	r.knownAlarms[id] = true
	return true
}

func (r *SessionRunner) clearKnownAlarm(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.knownAlarms, id)
}

func (r *SessionRunner) loadScenario(ctx context.Context) error {
	if r.svc.scenario == nil || r.scenarioID == "" {
		return nil
	}
	raw, err := r.svc.scenario.GetFullScenario(ctx, r.scenarioID)
	if err != nil {
		return err
	}
	var data ScenarioData
	if err := json.Unmarshal(raw, &data); err != nil {
		return err
	}
	r.engine.LoadScenario(r.sessionID, data)
	return nil
}

func (r *SessionRunner) pause() {
	r.mu.Lock()
	r.paused = true
	r.mu.Unlock()
}

func (r *SessionRunner) resume() {
	r.mu.Lock()
	r.paused = false
	r.mu.Unlock()
}

func (r *SessionRunner) stop() {
	r.mu.Lock()
	r.stopped = true
	r.mu.Unlock()
}

func (r *SessionRunner) isPaused() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.paused
}

func (r *SessionRunner) isStopped() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.stopped
}

func (r *SessionRunner) run(ctx context.Context) {
	// 250ms wall clock × 0.25s model dt keeps realtime pacing with snappier HMI.
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()

	for !r.isStopped() {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if r.isPaused() {
				continue
			}
			r.tick(ctx)
		}
	}
}

func (r *SessionRunner) tick(ctx context.Context) {
	state, err := r.svc.lockedStep(ctx, r.sessionID, 0.25)
	if err != nil {
		r.failCount++
		r.log.Error("sim step failed", "session", r.sessionID, "error", err, "fail_count", r.failCount)
		if r.failCount >= 5 {
			r.log.Error("stopping orphaned session runner after repeated sim failures", "session", r.sessionID)
			r.stop()
			mt := 0.0
			if sess, err := r.svc.repo.GetByID(ctx, r.sessionID); err == nil {
				mt = sess.ModelTime
			}
			_ = r.svc.repo.UpdateStatus(ctx, r.sessionID, domain.StatusStopped, mt)
			r.svc.mu.Lock()
			delete(r.svc.runners, r.sessionID)
			r.svc.mu.Unlock()
		}
		return
	}
	r.failCount = 0

	r.svc.broadcastSimSnapshot(ctx, r.sessionID, state)

	fired := r.engine.CheckTriggers(ctx, r.sessionID, state.ModelTime, state.Tags, r.svc.sim, r.svc.repo, r.svc.publisher)
	for _, f := range fired {
		r.svc.hub.BroadcastFault(r.sessionID, faultForWS(f))
	}

	if r.svc.assessment != nil {
		_ = r.svc.assessment.CheckMissedSteps(ctx, r.sessionID, state.ModelTime)
	}
}

var _ = json.Marshal
