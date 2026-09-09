
'use client'

import React, { useEffect, useRef, useState } from 'react'
import StarRatings from 'react-star-ratings';
import { TranslatedHeading, TranslatedParagraph } from '@/components/TranslatedContent';
import { Col, Container, Row } from 'react-bootstrap';
import { getBackendBaseUrl } from "@/utils/commonHelper";

const TestimonialsClient = () => {

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchReviews = async (pageNumber) => {
    setLoading(true);
    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + 'reviews/approved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: 'approved',
          page: pageNumber,
          limit: 9,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to fetch reviews');
      }

      const data = await res.json();
      setReviews(data?.data?.reviews || []);
      setTotalPages(data?.data?.pagination?.totalPages || 1);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching reviews:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(currentPage);
  }, [currentPage]);

  // Function to handle page changes
  const paginate = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= displayTotalPages) {
      setCurrentPage(pageNumber);
      const testimonialSection = document.querySelector('.testimonial_section');
      if (testimonialSection) {
        testimonialSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  };

  const testimonials = [
    {
      id: 1,
      name: "Sarah L.",
      role: "Self-Employed Designer",
      experienceDate: "May 19, 2025",
      text: "I’ve always dreaded tax season, but this service made the whole process stress-free. Clear instructions, fast turnaround, and really friendly support. I’ll definitely be using them again next year!",
      rating: 5,
      profile_img: ""
    },
    {
      id: 2,
      name: "James T.",
      role: "IT Consultant",
      experienceDate: "April 22, 2025",
      text: "Super efficient and professional. They explained everything clearly, spotted some deductions I’d missed, and saved me more than I expected. Worth every penny.",
      rating: 5,
      profile_img: ""
    },
    {
      id: 3,
      name: "Rachel M.",
      role: "Online Retailer",
      experienceDate: "March 15, 2025",
      text: "I run a small Etsy shop and wasn’t sure where to start with self-assessment. These guys made it simple. A few back-and-forth emails and it was all sorted in a few days.",
      rating: 5,
      profile_img: ""
    },
    {
      id: 4,
      name: "Amit P.",
      role: "Sole Trader",
      experienceDate: "February 28, 2025",
      text: "A very easy way to complete my tax return. Highly recommended. The online platform is very intuitive.",
      rating: 5,
      profile_img: ""
    },
    {
      id: 5,
      name: "James R.",
      role: "Freelance Photographer",
      experienceDate: "January 10, 2025",
      text: "TaxSimba made my tax return very easy. I finished it quickly. Great value for money.",
      rating: 5,
      profile_img: ""
    },
    {
      id: 6,
      name: "David K.",
      role: "Software Developer",
      experienceDate: "December 5, 2024",
      text: "The communication was excellent throughout the process. My assigned accountant was very helpful and answered all my questions.",
      rating: 5,
      profile_img: ""
    },
    {
      id: 7,
      name: "Emma S.",
      role: "Content Writer",
      experienceDate: "November 20, 2024",
      text: "Very professional service. They handled my rental income tax return without any hassle.",
      rating: 5,
      profile_img: ""
    },
    {
      id: 8,
      name: "Oliver H.",
      role: "E-commerce Seller",
      experienceDate: "October 30, 2024",
      text: "Simple, fast, and affordable. Saved me a lot of time and stress. Highly recommended!",
      rating: 5,
      profile_img: ""
    },
    {
      id: 9,
      name: "Sophia B.",
      role: "Marketing Consultant",
      experienceDate: "September 18, 2024",
      text: "Fantastic service. They helped me submit my first self-assessment tax return easily.",
      rating: 5,
      profile_img: ""
    }
  ];

  const filteredReviews = reviews.filter(r => {
    const msg = (r.message || r.text || "").toLowerCase();
    return msg.trim().length > 0 && !msg.includes("share your experience");
  });

  const isUsingFallback = filteredReviews.length === 0;
  const displayTestimonials = isUsingFallback ? testimonials : filteredReviews;
  const currentTestimonials = displayTestimonials;
  const displayTotalPages = isUsingFallback ? 1 : totalPages;

  return (
    <section className="testimonial_section pd-80 mt-0">
      <div className="container">
        {/* Display the testimonials in a flex grid layout */}
        {displayTestimonials.length === 0 && !loading ? (
          <div className="text-center py-5">
            <p className="text-muted fs-5">No reviews yet — check back soon!</p>
            <p className="text-muted small">Our clients love us. Verified reviews will appear here once submitted.</p>
          </div>
        ) : (
        <div className="grid">
          {currentTestimonials.map((testimonial, idx) => {
            const key =
              testimonial.id ||
              testimonial._id ||
              testimonial?.client?.id ||
              testimonial?.client?._id ||
              `testimonial-${idx}`;
            return (
              <div className="testimonial_items" key={key}>
                <div className="testimonial_card">
                  <span className="rating">
                    <StarRatings
                      rating={testimonial?.rating || 0}
                      starDimension="25px"
                      starSpacing="2px"
                      height="40px"
                      width="40px"
                      starRatedColor="#F89001"
                      starEmptyColor="#d1d1d1"
                    />

                  </span>
                  <TranslatedParagraph>{testimonial.message || testimonial.text}</TranslatedParagraph>
                  <span className="date_of_exp">
                    <strong>Date of experience:</strong>{" "}
                    {testimonial.experienceDate || formatDate(testimonial.createdAt)}
                  </span>
                </div>
                <div className="reviewer">
                  <figure className="avatar">
                    <img
                      className="avatar"
                      src={
                        testimonial?.client?.profilePhoto
                          ? testimonial?.client?.profilePhoto.startsWith('https')
                            ? testimonial?.client?.profilePhoto
                            : `${getBackendBaseUrl()}${testimonial?.client?.profilePhoto}`
                          : testimonial?.profile_img || "/images/user.png"
                      }
                      alt={testimonial?.client?.name || testimonial?.name || "profile"}
                    />
                  </figure>
                  <div className="reviewer_dtls">
                    <h5>{testimonial?.client?.name || testimonial.name}</h5>
                    <p>{testimonial?.client?.role || testimonial.role}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        )}

        {/* Pagination — only shown when reviews exist and there's more than one page */}
        {displayTestimonials.length > 0 && displayTotalPages > 1 && (
        <div className="pagination">
          {/* Prev Button */}
          <button
            className="prev"
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
          >
            « Prev
          </button>

          {/* Page Buttons */}
          {[...Array(displayTotalPages)].map((_, index) => (
            <button
              key={index}
              className={`page-btn ${currentPage === index + 1 ? 'active' : ''}`}
              onClick={() => paginate(index + 1)}
            >
              {index + 1}
            </button>
          ))}

          {/* Next Button */}
          <button
            className="next"
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === displayTotalPages}
          >
            Next »
          </button>
        </div>
        )}
      </div>
    </section>
  )
}

export default TestimonialsClient
