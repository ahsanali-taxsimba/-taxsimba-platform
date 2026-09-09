"use client";

import React, { Children, Fragment, use } from "react";
import { useTranslate } from "@/hooks/useTranslate";
import Link from "next/link";

const TranslatedTextNode = ({ text }) => {
  const translatedText = useTranslate(text);
  return <>{translatedText}</>;
};

export const TranslatedHeading = ({ children, className = "", as = "h1" }) => {
  const translatedText = useTranslate(children);
  const Component = as;
  return <Component className={className}>{translatedText}</Component>;
};

export const TranslatedHeadingTwo = ({ children, className = "", as = "h2", prefix, suffix }) => {
  const translatedText = useTranslate(children);
  const Component = as;
  return (
    <Component className={className}>
      {prefix}
      {translatedText}
      {suffix}
    </Component>
  );
};

export const TranslatedHeadingThree = ({ children, className = "", as = "h3" }) => {
  const translatedText = useTranslate(children);
  const Component = as;
  return <Component className={className}>{translatedText}</Component>;
};

export const TranslatedHeadingFour = ({ children, className = "", as = "h4" }) => {
  const translatedText = useTranslate(children);
  const Component = as;
  return <Component className={className}>{translatedText}</Component>;
};

export const TranslatedHeadingFive = ({ children, className = "", as = "h5" }) => {
  const translatedText = useTranslate(children);
  const Component = as;
  return <Component className={className}>{translatedText}</Component>;
};

export const TranslatedHeadingSix = ({ children, className = "", as = "h6" }) => {
  const translatedText = useTranslate(children);
  const Component = as;
  return <Component className={className}>{translatedText}</Component>;
};

export const TranslatedParagraph = ({ children, className = "", strongpref = "", strong = "", strongSuf = "" }) => {
  const translatedText = useTranslate(children);
  const transpref = useTranslate(strongpref);
  const transSuf = useTranslate(strongSuf);
  const transStrong = useTranslate(strong);
  if (strong) {
    return (
      <p className={className}>
        {transpref}
        <strong>{transStrong}</strong>
        {transSuf}
        {translatedText}
      </p>
    );
  }
  return <p className={className}>{translatedText}</p>;
};

export const TranslatedNestedParagraph = ({ children, className = "" }) => {
  return (
    <p className={className}>
      {Children.map(children, (child, index) => {
        if (typeof child !== "string") {
          return child;
        }

        if (child.trim() === "") {
          return child;
        }

        return (
          <Fragment key={index}>
            <TranslatedTextNode text={child} />
          </Fragment>
        );
      })}
    </p>
  );
};

export const TranslatedSpan = ({ children, className = "" }) => {
  const translatedText = useTranslate(children);
  return <span className={className}>{translatedText}</span>;
};
export const TranslatedStrong = ({ children, className = "" }) => {
  const translatedText = useTranslate(children);
  return <strong className={className}>{translatedText}</strong>;
};

export const TranslatedLi = ({ children, className = "", prefix, suffix }) => {
  const translatedText = useTranslate(children);
  return (
    <li className={className}>
      {prefix}
      {translatedText}
      {suffix}
    </li>
  );
};

export const TranslatedButton = ({ children, className = "", onClick, ...props }) => {
  const translatedText = useTranslate(children);
  return (
    <button className={className} onClick={onClick} {...props}>
      {translatedText}
    </button>
  );
};

export const TranslatedLink = ({ children, href, className = "", ...props }) => {
  const translatedText = useTranslate(children);
  return (
    <a href={href} className={className} {...props}>
      {translatedText}
    </a>
  );
};

export const TranslatedText = ({ children, className = "" }) => {
  const translatedText = useTranslate(children);
  return <div className={className}>{translatedText}</div>;
};

export const TranslatedNextLink = ({ children, href, className = "", ...props }) => {
  const translatedText = useTranslate(children);
  return (
    <Link href={href} className={className} {...props}>
      {translatedText}
    </Link>
  );
};

export const TranslatedNestedDiv = ({ children, prefixStr = null, prefix, className = "", ...props }) => {
  const translatedText = useTranslate(children);
  const translatedPrefix = prefixStr ? useTranslate(prefixStr) : null;
  return (
    <div className={className} {...props}>
      {prefixStr ? translatedPrefix : null}
      {prefix}
      {translatedText}
    </div>
  );
};

export const TranslatedInput = ({
  type = "text",
  name,
  value,
  onChange,
  className = "",
  placeholder = "",
  "aria-label": ariaLabel,
  ...props
}) => {
  const translatedPlaceholder = useTranslate(placeholder);
  const translatedAria = ariaLabel ? useTranslate(ariaLabel) : undefined;

  return (
    <input
      type={type}
      name={name}
      value={value}
      placeholder={translatedPlaceholder}
      aria-label={translatedAria}
      className={className}
      onChange={onChange}
      {...props}
    />
  );
};

export const TranslatedTextarea = ({
  name,
  value,
  onChange,
  className = "",
  placeholder = "",
  "aria-label": ariaLabel,
  ...props
}) => {
  const translatedPlaceholder = useTranslate(placeholder);
  const translatedAria = ariaLabel ? useTranslate(ariaLabel) : undefined;

  return (
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      placeholder={translatedPlaceholder}
      aria-label={translatedAria}
      className={className}
      {...props}
    />
  );
};