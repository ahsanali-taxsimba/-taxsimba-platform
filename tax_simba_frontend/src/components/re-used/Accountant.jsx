"use client";

import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, FreeMode } from "swiper/modules";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan, TranslatedLink } from "@/components/TranslatedContent";
import TranslatedText from "@/components/TranslatedText";

const accountants = [
  { img: "/images/acc1.png", name: "Faran Smithen", title: "CA" },
  { img: "/images/acc2.png", name: "Faran Smithen", title: "CA" },
  { img: "/images/acc3.png", name: "Faran Smithen", title: "CA" },
  { img: "/images/acc2.png", name: "Faran Smithen", title: "CA" },
];

const Accountant = ({ classaName, blue_txt, heading, discription, header }) => {
  return (
    <section className={classaName || "accountant"}>
      <div className="container">
        {header &&
          <div className="global_heading text-center">
            <TranslatedHeadingTwo
              prefix={
                <TranslatedSpan className="blue_txt">{header}</TranslatedSpan>
              }
            >
              {heading}
            </TranslatedHeadingTwo>
            <TranslatedParagraph>{discription}</TranslatedParagraph>
          </div>
        }
        
      </div>
    </section>
  );
};

export default Accountant;
