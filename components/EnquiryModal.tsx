import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Modal from "./Modal";
import Button from "./Button";
import Input from "./Input";
import Select from "./Select";
import Textarea from "./Textarea";
import { EVENT_TYPES } from "@/lib/sharedConfig";

export default function EnquiryModal({
  open,
  onClose,
  artistId,
  clientId,
}: {
  open: boolean;
  onClose: () => void;
  artistId: string;
  clientId: string;
}) {
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const { error: dbError } = await supabase.from("enquiries").insert({
        artist_id: artistId,
        client_id: clientId,
        event_type: eventType,
        event_date: eventDate || null,
        location,
        message,
      });
      if (dbError) throw dbError;
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send enquiry");
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    onClose();
    setTimeout(() => { setSent(false); setEventType(""); setEventDate(""); setLocation(""); setMessage(""); }, 300);
  }

  return (
    <Modal open={open} onClose={handleClose} title={sent ? "Enquiry sent" : "Contact this artist"}>
      {sent ? (
        <>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Your enquiry has been sent. You&apos;ll be notified here once the artist responds — if they&apos;re interested or need more details, a private conversation opens inside ArtiSync. Contact details are never shared without both sides&apos; consent.
          </p>
          <Button type="button" variant="primary" size="md" fullWidth className="mt-6" onClick={handleClose}>
            Done
          </Button>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Event type" value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">Select event type</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input label="Event date" optional type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          <Input label="Location" optional value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or venue" />
          <Textarea label="Message" optional value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Tell them a bit about your event…" />
          {error && (
            <p className="rounded-[var(--radius-md)] bg-[var(--color-error-soft)] px-4 py-3 text-sm text-[var(--color-error)]" role="alert">{error}</p>
          )}
          <Button type="submit" variant="primary" size="md" fullWidth disabled={sending}>
            {sending ? "Sending…" : "Send enquiry"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
