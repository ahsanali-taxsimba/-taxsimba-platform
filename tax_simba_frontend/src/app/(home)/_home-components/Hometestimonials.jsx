"use client";
import React, { useEffect, useState, useRef } from 'react'
import { Swiper, SwiperSlide } from "swiper/react";
// import SwiperCore, { Navigation } from "swiper";
import { Navigation } from "swiper/modules";

import { Rating, RoundedStar } from "@smastrom/react-rating";
import Image from 'next/image';
import { getBackendBaseUrl } from "@/utils/commonHelper";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan, TranslatedText, TranslatedNestedParagraph } from "@/components/TranslatedContent";
const HomeTestimonials = () => {
  // SwiperCore.use([Navigation]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const prevRef = useRef(null);
  const nextRef = useRef(null);

  const testimonials = [
    {
      ratingImg: "/images/rating.png",
      text: `I’ve always dreaded tax season, but this service made the
    whole process stress-free. Clear instructions, fast
    turnaround, and really friendly support. I’ll definitely be
    using them again next year!`,
      name: "Sophie L.",
      role: "Freelance Graphic Designer",
    },
    {
      ratingImg: "/images/rating.png",
      text: `Super efficient and professional. They explained everything
    clearly, spotted some deductions I’d missed, and saved me more
    than I expected. Worth every penny.`,
      name: "James T.",
      role: "IT Consultant",
    },
    {
      ratingImg: "/images/rating.png",
      text: `I run a small Etsy shop and wasn’t sure where to start with
    self-assessment. These guys made it simple. A few
    back-and-forth emails and it was all sorted in a few days.`,
      name: "Rachel M.",
      role: "Online Retailer",
    },
    {
      ratingImg: "/images/rating.png",
      text: `A very easy way to complete my tax return. Highly recommended. The online platform is intuitive and expert help was always available.`,
      name: "Amit P.",
      role: "Sole Trader",
    },
  ];

  const fetchReviews = async () => {
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + 'reviews/approved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: 'approved',
          page: 1,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch reviews');
      }

      const data = await res.json();
      setReviews(data?.data?.reviews || []);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching reviews:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [])

  return (
    <>
      <section
        className="users_say_sec"
        style={{ backgroundImage: "url(/images/auths_say_bg.jpg)" }}
      >
        <div className="container">
          <div className="global_heading text-center white_txt">
            <TranslatedHeadingTwo>Here’s What Some of Our Happy Clients Are Saying</TranslatedHeadingTwo>
            <TranslatedParagraph>
              This is how we made tax season stress-free with our expert help
              for them
            </TranslatedParagraph>
          </div>
          <div className="testimonia_sider_holder">
            <div ref={prevRef} className="swiper-button-prev" />
            <div ref={nextRef} className="swiper-button-next" />
            {/* new */}
            <Swiper
              className="testimonial_slider swiper"
              slidesPerView={3}
              spaceBetween={20}
              loop={true}
              modules={[Navigation]}
              navigation={{
                prevEl: prevRef.current,
                nextEl: nextRef.current,
              }}
              onBeforeInit={(swiper) => {
                swiper.params.navigation.prevEl = prevRef.current;
                swiper.params.navigation.nextEl = nextRef.current;
              }}
              breakpoints={{
                0: { slidesPerView: 1 },
                767: { slidesPerView: 2 },
                1199: { slidesPerView: 3 },
              }}
            >
              {(Array.isArray(reviews) && reviews.length > 0) ?
                reviews.map((res, index) => {
                  const truncatedMessage = res?.message?.length > 100 ? res?.message.substring(0, 100) + "..." : res?.message;

                  return (
                    <SwiperSlide
                      key={index}
                      className="testimonial_slider_item swiper-slide"
                    >
                      <div className="testimonial_slider_item_inner">
                        <span className="rating">
                          <Rating
                            style={{ maxWidth: 120 }}
                            itemStyles={{
                              itemShapes: RoundedStar,
                              activeFillColor: "#f59e0b",
                              inactiveFillColor: "#d1d5db",
                            }}
                            value={Number(res?.rating) || 0}
                            readOnly
                          />
                        </span>
                        <TranslatedNestedParagraph>"{res?.message}"</TranslatedNestedParagraph>
                        <div className="reviewer">
                          <Image
                            src={
                              res?.client?.profilePhoto
                                ? res?.client?.profilePhoto.startsWith('https')
                                  ? res?.client?.profilePhoto
                                  : `${getBackendBaseUrl()}${res?.client?.profilePhoto}`
                                : `/images/user.png`
                            }
                            height={50}
                            width={50}
                            alt="profile image"
                          />
                          <div className="reviewer_dtls">
                            <h5>{res?.client?.name}</h5>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                  )
                }) : (testimonials.map(({ ratingImg, text, name, role }, idx) => (
                  <SwiperSlide
                    key={idx}
                    className="testimonial_slider_item swiper-slide"
                  >
                    <div className="testimonial_slider_item_inner">
                      <span className="rating">
                        <img src={ratingImg} alt="Rating" />
                      </span>
                      <p>{text}</p>
                      <div className="reviewer">
                        <figure />
                        <div className="reviewer_dtls">
                          <h5>{name}</h5>
                          <p>{role}</p>
                        </div>
                      </div>
                    </div>
                  </SwiperSlide>
                )))}
            </Swiper>

          </div>
        </div>
      </section>
    </>
  )
}

export default HomeTestimonials;
