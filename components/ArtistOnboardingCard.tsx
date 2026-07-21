import Modal from "./Modal";
import Button from "./Button";

export default function ArtistOnboardingCard({
  open,
  onComplete,
  onLater,
}: {
  open: boolean;
  onComplete: () => void;
  onLater: () => void;
}) {
  return (
    <Modal open={open} onClose={onLater} title="Complete your artist profile">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Add your skills, portfolio, location, pricing, and availability so clients can discover and contact you.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <Button type="button" variant="primary" size="md" fullWidth onClick={onComplete}>
          Complete Profile
        </Button>
        <Button type="button" variant="ghost" size="md" fullWidth onClick={onLater}>
          Do It Later
        </Button>
      </div>
    </Modal>
  );
}
