import Link from "next/link";

// Consistent premium page header: big gradient title + a gold→grass accent
// underline, optional subtitle and a back link. Used on every inner page.
export default function PageHeader({
  title,
  subtitle,
  back,
}: {
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
}) {
  return (
    <div>
      {back && (
        <Link
          href={back.href}
          className="text-sm text-white/50 transition hover:text-white"
        >
          ← {back.label}
        </Link>
      )}
      <h1 className="title-lux mt-0.5 text-3xl">{title}</h1>
      <div className="mt-2 h-0.5 w-12 rounded-full bg-gradient-to-r from-gold to-grass" />
      {subtitle && <p className="mt-2 text-sm text-white/50">{subtitle}</p>}
    </div>
  );
}
