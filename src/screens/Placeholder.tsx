import { NOT_BUILT } from '../strings';

export function Placeholder({ title }: { title: string }) {
  return (
    <section aria-labelledby="ph-title">
      <h1 id="ph-title">{title}</h1>
      <p>{NOT_BUILT}</p>
    </section>
  );
}
