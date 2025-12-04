import React from "react";
import { getToken } from "../utils/auth";
import NotSignedIn from "./NotSignedIn";

type Props = {
  children: React.ReactNode;
  pageName?: string;
};

const RequireAuth: React.FC<Props> = ({ children, pageName }) => {
  const token = getToken();

  if (!token) {
    return <NotSignedIn pageName={pageName} />;
  }

  return <>{children}</>;
};

export default RequireAuth;