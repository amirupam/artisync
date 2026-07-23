import Container from "./Container";
import Logo from "./Logo";

const LINKS = [
  { label: "Find Artists", href: "/artists" },
  { label: "Join as an Artist", href: "/signup?role=artist" },
  { label: "Sign In", href: "/signup?role=artist" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-primary)]">
      <Container className="py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Logo variant="light" size="md" />
            <p className="mt-3 text-sm text-[var(--color-text-on-dark-soft)]">
              Discover talent. Create together.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-[var(--color-text-on-dark-soft)] hover:text-white transition-colors
                  focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] rounded-sm"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-[var(--color-text-on-dark-soft)]">
          © {new Date().getFullYear()} ArtiSync. All rights reserved.
        </div>
      </Container>
    </footer>
  );
}
