import React from "react";

export const Button: React.FC<{ onClick: React.MouseEventHandler<HTMLDivElement> }> = ({ onClick }) => <div role="button" onClick={onClick}>click me</div>;
