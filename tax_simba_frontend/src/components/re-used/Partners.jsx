"use client";

import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, FreeMode } from "swiper/modules";
import Link from "next/link";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan } from "@/components/TranslatedContent";
import { useTranslate } from "@/hooks/useTranslate";

const partners = [
  "/partners_logo/img1.png",
  "/partners_logo/img2.png",
  "/partners_logo/img3.png",
  "/partners_logo/img4.png"
];

export default function Partners({ page, className, heading, discription }) {
  const headingText = useTranslate(heading);
  return (
    <section className={className}>
      <div className="container">
        <div className="our_partner_holder">
          
          <div className="common-title text-center mb-lg-5 mb-4">
            <h2 className='mb-2'>Our <span>Partners & Press</span></h2>
            <p>Trusted by Individuals and Businesses Across the UK</p>
          </div>

          <div className="our_partner_slider_outer">
            <Swiper
              className="ourpartner_slider swiper"
              slidesPerView="auto"
              freeMode={true}
              grabCursor={true}
              spaceBetween={40}
              autoplay={{ delay: 2000, disableOnInteraction: false }}
              loop={true}
            >
              {partners.map((src, idx) => (
                <SwiperSlide
                  key={idx}
                  className="looking_for_item swiper-slide"
                  style={{ width: "auto" }} // support auto width
                >
                  <div href="#" className="looking_for_item_inner">
                    <img src={src} alt={`Partner ${idx + 1}`} />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </div>
    </section>
  );
}
