import { programBrandMetadata } from "@/lib/queries/program-brand";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return programBrandMetadata(slug);
}

// Голый каркас для экрана звонка: без боковой панели и вкладок — только разговор.
export default function CallLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
