import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Mic, MicOff, Pencil, Send, Sparkles, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { notesApi } from '../api/endpoints';
import Breadcrumb from '../components/Breadcrumb';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { withDisplayNumbers } from '../utils/notes';

const SpeechRecognitionCtor = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function NoteChat() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState(null);
  const [composerText, setComposerText] = useState('');
  const [sending, setSending] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editingBody, setEditingBody] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState(null);
  const recognitionRef = useRef(null);
  const recordingBaseTextRef = useRef('');

  const streamEndRef = useRef(null);

  function load() {
    Promise.all([notesApi.detail(id), notesApi.messages(id), notesApi.list()])
      .then(([chatRes, messagesRes, listRes]) => {
        // displayTitle needs every chat's createdAt to compute "Untitled N"
        // consistently with the list page -- same shared helper, so a chat
        // never shows a different number in its own header than it does there.
        const [withNumber] = withDisplayNumbers(listRes.data).filter((c) => c.id === chatRes.data.id);
        setChat({ ...chatRes.data, displayTitle: withNumber?.displayTitle || chatRes.data.title || 'Untitled' });
        setMessages(messagesRes.data);
      })
      .catch(() => navigate('/notes'));
  }

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, awaitingReply]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  async function send() {
    const body = composerText.trim();
    if (!body || sending) return;
    setSending(true);
    if (chat.aiEnabled) setAwaitingReply(true);
    try {
      const { data } = await notesApi.sendMessage(id, body);
      setComposerText('');
      setMessages((prev) => {
        const next = [...prev, data.userMessage];
        if (data.assistantMessage) next.push(data.assistantMessage);
        if (data.aiNotice) next.push({ id: `notice-${Date.now()}`, role: 'notice', body: data.aiNotice, createdAt: new Date().toISOString() });
        return next;
      });
    } catch {
      toast.error('Could not send message');
    } finally {
      setSending(false);
      setAwaitingReply(false);
    }
  }

  function onComposerKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function startRename() {
    setRenameValue(chat.title || '');
    setRenaming(true);
  }

  async function saveRename() {
    setRenaming(false);
    const title = renameValue.trim() || null;
    if (title === chat.title) return;
    try {
      const { data } = await notesApi.update(id, { title });
      // A real title replaces the number outright; clearing it back to
      // null falls back to the same "Untitled N" this chat already had,
      // since its creation-order number never changes.
      setChat({ ...data, displayTitle: data.title || chat.displayTitle });
    } catch {
      toast.error('Could not rename chat');
    }
  }

  async function toggleAi() {
    try {
      const { data } = await notesApi.update(id, { aiEnabled: !chat.aiEnabled });
      setChat({ ...data, displayTitle: chat.displayTitle });
    } catch {
      toast.error('Could not update Talk to AI');
    }
  }

  function startEdit(message) {
    setEditingId(message.id);
    setEditingBody(message.body);
  }

  async function saveEdit(messageId) {
    const body = editingBody.trim();
    if (!body) return;
    try {
      const { data } = await notesApi.editMessage(messageId, body);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? data : m)));
      setEditingId(null);
    } catch {
      toast.error('Could not edit message');
    }
  }

  async function confirmDeleteMessage() {
    if (!deleteTarget) return;
    setDeletingMessage(true);
    try {
      await notesApi.removeMessage(deleteTarget.id);
      setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error('Could not delete message');
    } finally {
      setDeletingMessage(false);
    }
  }

  function startRecording() {
    if (!SpeechRecognitionCtor) return;
    setMicError(null);
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recordingBaseTextRef.current = composerText;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((r) => r[0].transcript).join('');
      const base = recordingBaseTextRef.current;
      setComposerText(base ? `${base} ${transcript}` : transcript);
    };
    recognition.onerror = (event) => {
      setMicError(
        event.error === 'not-allowed' || event.error === 'permission-denied'
          ? 'Microphone access was blocked. Enable it in your browser settings to use voice input.'
          : 'Voice input failed. You can keep typing instead.'
      );
      setRecording(false);
    };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  if (!chat || messages === null) return <main className="page-container py-6 text-center text-muted">Loading chat...</main>;

  return (
    <>
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-4">
      <Breadcrumb items={[{ label: 'Notes', to: '/notes' }, { label: chat.displayTitle }]} onBack={() => navigate('/notes')} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {renaming ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-1.5"
            onSubmit={(e) => { e.preventDefault(); saveRename(); }}
          >
            <input
              className="field"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Untitled"
              autoFocus
              onBlur={saveRename}
            />
            <button type="submit" className="btn-icon shrink-0" aria-label="Save name"><Check size={15} /></button>
          </form>
        ) : (
          <button type="button" className="min-w-0 truncate text-left text-lg font-semibold hover:underline" onClick={startRename}>
            {chat.displayTitle}
          </button>
        )}

        <button
          type="button"
          className={`btn-ghost shrink-0 ${chat.aiEnabled ? 'border-primary text-primary' : ''}`}
          onClick={toggleAi}
          aria-pressed={chat.aiEnabled}
        >
          <Sparkles size={15} /> Talk to AI: {chat.aiEnabled ? 'On' : 'Off'}
        </button>
      </div>

      <div className="space-y-3 pb-3">
        {!messages.length && (
          <div className="card p-8 text-center text-sm text-muted">Nothing here yet. Say something below.</div>
        )}
        {messages.map((message) => {
          if (message.role === 'notice') {
            return (
              <div key={message.id} className="mx-auto max-w-sm rounded-md bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                {message.body}
              </div>
            );
          }
          const isUser = message.role === 'user';
          const isEditing = editingId === message.id;
          return (
            <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`group max-w-[85%] rounded-lg px-3 py-2 ${isUser ? 'bg-slate-100 text-text dark:bg-slate-700 dark:text-slate-100' : 'card'}`}>
                {isEditing ? (
                  <div className="space-y-1.5">
                    <textarea
                      className="field text-sm"
                      rows={2}
                      value={editingBody}
                      onChange={(e) => setEditingBody(e.target.value)}
                      autoFocus
                    />
                    <div className="flex justify-end gap-1.5">
                      <button className="btn-icon h-7 w-7" onClick={() => setEditingId(null)} aria-label="Cancel edit"><X size={13} /></button>
                      <button className="btn-icon h-7 w-7" onClick={() => saveEdit(message.id)} aria-label="Save edit"><Check size={13} /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm">{message.body}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                      <span>{formatTime(message.createdAt)}</span>
                      <span className="ml-auto hidden items-center gap-1 group-hover:flex">
                        <button className="opacity-70 hover:opacity-100" onClick={() => startEdit(message)} aria-label="Edit message"><Pencil size={12} /></button>
                        <button className="opacity-70 hover:opacity-100" onClick={() => setDeleteTarget(message)} aria-label="Delete message"><Trash2 size={12} /></button>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {awaitingReply && (
          <div className="flex justify-start">
            <div className="card px-3 py-2 text-sm text-muted">Thinking…</div>
          </div>
        )}
        <div ref={streamEndRef} />
      </div>
    </main>

    {/* position: fixed, not sticky -- sticky only locks once the page has
        scrolled enough to run out of room, so on a short conversation it
        sat right after the last message and visibly slid down the page as
        messages were added. Fixed removes it from document flow entirely,
        so it never moves; the message stream above is what scrolls (and
        auto-scrolls to bottom via streamEndRef), exactly like the composer
        was always meant to behave. Anchored at bottom-16, the same offset
        as before, to keep sitting just above the fixed BottomNav. */}
    <div className="fixed inset-x-0 bottom-16 z-10 border-t border-border bg-bg dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-3">
        {micError && (
          <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{micError}</p>
        )}
        <div className="flex items-end gap-2">
          {SpeechRecognitionCtor && (
            <button
              type="button"
              className={`btn-icon shrink-0 ${recording ? 'animate-pulse border-red-400 text-red-600' : ''}`}
              onClick={recording ? stopRecording : startRecording}
              aria-label={recording ? 'Stop recording' : 'Start voice input'}
            >
              {recording ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
          <textarea
            className="field flex-1 resize-none"
            rows={1}
            placeholder="Write a note..."
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={onComposerKeyDown}
          />
          <button className="btn-primary shrink-0" onClick={send} disabled={sending || !composerText.trim()} aria-label="Send">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>

    {deleteTarget && (
      <DeleteConfirmModal
        title="Delete this message?"
        warning="This can't be undone."
        confirmLabel="Delete"
        loading={deletingMessage}
        onConfirm={confirmDeleteMessage}
        onClose={() => setDeleteTarget(null)}
      />
    )}
    </>
  );
}
