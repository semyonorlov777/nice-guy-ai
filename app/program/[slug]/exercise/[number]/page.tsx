export default async function ExercisePage({
  params,
}: {
  params: Promise<{ slug: string; number: string }>;
}) {
  const { number } = await params;

  return (
    <div className="stub-page">
      <div className="stub-page-icon">{"\u{1F4DD}"}</div>
      <div className="stub-page-text">
        Упражнение {number} — скоро будет
      </div>
    </div>
  );
}
