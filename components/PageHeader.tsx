import IgotBadge from "./IgotBadge";

export default function PageHeader({
  crumb,
  heading,
  subheading,
  showIgot = true,
}: {
  crumb: string;
  heading: string;
  subheading: string;
  showIgot?: boolean;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="crumb">{crumb}</div>
        <h1>{heading}</h1>
        <p>{subheading}</p>
      </div>
      {showIgot && <IgotBadge />}
    </div>
  );
}
