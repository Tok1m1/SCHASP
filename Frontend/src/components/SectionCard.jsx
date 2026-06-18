export default function SectionCard({ title, children, right }) {
  return (
    <section className="card">
      <div className="cardHeader">
        <h2 className="cardTitle">{title}</h2>
        {right || null}
      </div>
      {children}
    </section>
  );
}
