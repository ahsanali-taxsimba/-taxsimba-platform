"use client";
import React from "react";

const Loading = () => {
  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{ height: "50vh", backgroundColor: "rgba(255, 255, 255, 0.5)" }}
    >
      <div className="spinner-border theme-color" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  );
};

export default Loading;
