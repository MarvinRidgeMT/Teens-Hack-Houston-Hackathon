// Pickup message protocol. Owner: Anish (Engine).
// Every message is a flat object: { type: MSG.x, ...fields }.
// Content scripts copy the strings they use; keep them stable after the Gate.

export const MSG = Object.freeze({
  // Service worker -> content script
  snapshot: 'snapshot',         // reply: { url, scrollY, highlight }
  showCard: 'showCard',         // { eventId, threadName, awayMs, nextStep?, nextStepSource?, where: { scrollY, highlight }, tabCount }
  armTimer: 'armTimer',         // { eventId } sent on every return, both conditions
  restoreScroll: 'restoreScroll', // { scrollY }
  openOverlay: 'openOverlay',   // { askTaskName: boolean }
  // OPTIONAL (Feature 2, stretch): a content script may ignore it.
  startHere: 'startHere',       // { threadName, nextStep?, nextStepSource?, wrappedAt }

  // Content script -> service worker
  state: 'state',               // { url, scrollY, highlight } debounced 2 s
  firstInteraction: 'firstInteraction', // { eventId, at }
  cardAction: 'cardAction',     // { eventId, action: 'resume' | 'notNow' | 'tidy' }
  parkNote: 'parkNote',         // { nextStep, taskName? }

  // Popup / pages -> service worker (added at kickoff; reply shown after each)
  getTabInfo: 'getTabInfo',     // { tabId } -> { ok, isWork, isDistraction, thread, suggested: [{tabId,url,title}], openBreak }
  startTask: 'startTask',       // { tabId, name, taskType? } -> { ok, thread }
  removeFromThread: 'removeFromThread', // { threadId, tabId } -> { ok }
  keepInThread: 'keepInThread', // { threadId, tabId } -> { ok }   (suggested -> manual)
  park: 'park',                 // { tabId } -> { ok }   same as Alt+P
  wrapUp: 'wrapUp',             // { tabId, nextStep? } -> { ok, wrapUp }  save for tomorrow (Feature 2)
  setTaskType: 'setTaskType',   // { threadId, taskType } -> { ok }
  resumeTask: 'resumeTask',     // { threadId? } -> { ok, threadId }  same as Alt+R (Feature 1)
  voiceCommand: 'voiceCommand', // { intent, args } -> { ok, say, data }   voice side panel
  setVoiceSettings: 'setVoiceSettings', // { voiceEnabled?, wakeWord?, readAloud? } -> { ok, voiceEnabled, wakeWord, readAloud }
  // Pickup panel (Fri):
  startBreak: 'startBreak',     // { minutes, nextStep?, tabId? } -> { ok, endsAt, threadId }
  cancelBreak: 'cancelBreak',   // {} -> { ok }   clears the timer; the break stays open
  listThreads: 'listThreads',   // {} -> [{ threadId, name, taskType, nextStep?, nextStepSource?, leftAt?, url, tabCount, isOpenBreak, isParked, isWrapped, awaySince?, endsAt?, sortAt }]
  setNextStep: 'setNextStep',   // { threadId, nextStep } -> { ok }   typed in the panel's task list
});

// Types the service worker answers (content script + popup/pages -> SW).
export const TO_ENGINE = Object.freeze([
  MSG.state, MSG.firstInteraction, MSG.cardAction, MSG.parkNote,
  MSG.getTabInfo, MSG.startTask, MSG.removeFromThread, MSG.keepInThread,
  MSG.setTaskType, MSG.park, MSG.wrapUp, MSG.resumeTask,
  MSG.voiceCommand, MSG.setVoiceSettings,
  MSG.startBreak, MSG.cancelBreak, MSG.listThreads, MSG.setNextStep,
]);

// Optional SW -> content types: a missing handler is fine (check-integration WARNs).
export const OPTIONAL_TO_CONTENT = Object.freeze([MSG.startHere]);

// Types the content script receives (SW -> content).
export const TO_CONTENT = Object.freeze([
  MSG.snapshot, MSG.showCard, MSG.armTimer, MSG.restoreScroll, MSG.openOverlay,
]);

export const CARD_ACTIONS = Object.freeze({ resume: 'resume', notNow: 'notNow', tidy: 'tidy' });
