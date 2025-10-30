import { API } from "../lib/api";

function prox(url){ return `${API}/api/v1/img?url=${encodeURIComponent(url)}` }

export default function PartThumb({ part_num, color_id, size=100 }){
  const candidates = [
    `https://cdn.rebrickable.com/media/parts/${color_id}/${part_num}.png`,
    `https://cdn.rebrickable.com/media/parts/${color_id}/${part_num}.jpg`,
    `https://cdn.rebrickable.com/media/parts/ldraw/${part_num}.png`,
    `https://cdn.rebrickable.com/media/parts/${part_num}.jpg`,
  ];
  const img = document?.createElement ? new Image() : null;
  const tryNext = (e) => {
    const i = candidates.indexOf(e.currentTarget.dataset.src);
    const next = candidates[i+1];
    if(next){ e.currentTarget.dataset.src = next; e.currentTarget.src = prox(next); }
    else { e.currentTarget.style.visibility = "hidden"; }
  };

  const first = candidates[0];
  return (
    <img
      src={prox(first)}
      data-src={first}
      onError={tryNext}
      alt={part_num}
      loading="lazy"
      style={{ width:size, height:size, objectFit:"contain" }}
    />
  );
}
