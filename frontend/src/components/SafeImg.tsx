import React from "react";

type SafeImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
};

const DEFAULT_FALLBACK = "/branding/missing.png";

const SafeImg: React.FC<SafeImgProps> = ({
  src,
  fallbackSrc = DEFAULT_FALLBACK,
  onError,
  ...rest
}) => {
  const [currentSrc, setCurrentSrc] = React.useState(() => {
    const trimmed = typeof src === "string" ? src.trim() : "";
    return trimmed ? trimmed : fallbackSrc;
  });
  const fallbackTried = React.useRef(false);

  React.useEffect(() => {
    const trimmed = typeof src === "string" ? src.trim() : "";
    const next = trimmed ? trimmed : fallbackSrc;
    setCurrentSrc(next);
    fallbackTried.current = next === fallbackSrc;
  }, [src, fallbackSrc]);

  const handleError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (!fallbackTried.current && fallbackSrc && currentSrc !== fallbackSrc) {
      fallbackTried.current = true;
      setCurrentSrc(fallbackSrc);
    }
    if (onError) {
      onError(event);
    }
  };

  return <img {...rest} src={currentSrc} onError={handleError} />;
};

export default SafeImg;
