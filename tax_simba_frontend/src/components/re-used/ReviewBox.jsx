"use client";
import React, { useEffect, useState } from "react";
import { Rating, RoundedStar } from "@smastrom/react-rating";
import { toast } from "react-hot-toast";
import { FaEdit, FaRegTrashAlt, FaSave } from "react-icons/fa";
import { MdModeEdit } from "react-icons/md";
import { AiOutlineClose } from "react-icons/ai";
import { IoMdCloseCircleOutline } from "react-icons/io";
import { Modal, Button } from "react-bootstrap";

const ReviewBox = ({ file, token }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [review, setReview] = useState("");
    const [tempReview, setTempReview] = useState("");
    const [rating, setRating] = useState(0);
    const [tempRating, setTempRating] = useState(0);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const ids = {
        taxReturnId: file?.taxReturn?.id,
        accountantId: file?.accountant?.id,
    };

    const baseUrl = process.env.NEXT_PUBLIC_API_URL?.endsWith("/") 
        ? process.env.NEXT_PUBLIC_API_URL 
        : `${process.env.NEXT_PUBLIC_API_URL}/`;

    // Custom Modal instead of Toast
    const handleDeleteClick = () => {
        setShowConfirm(true);
    };


    // ✅ Fetch existing review
    useEffect(() => {
        const fetchReview = async () => {
            if (!ids.taxReturnId || !token) return;
            try {
                const res = await fetch(
                    `${baseUrl}client/reviews/tax-return/${ids.taxReturnId}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (!res.ok) throw new Error("Failed to fetch review");
                const data = await res.json();


                if (data?.data) {
                    setReview(data.data.message || data.data.review || "");
                    setRating(data.data.rating || 0);
                }
            } catch (err) {
                console.error("Error fetching review:", err);
                // toast.error("Error fetching review");
            }
        };

        fetchReview();
    }, [ids.taxReturnId, token, baseUrl]);

    // ✅ Handle edit
    const handleEdit = () => {
        setTempReview(review);
        setTempRating(rating);
        setIsEditing(true);
    };

    // ✅ Handle save (POST or PUT)
    const handleSave = async () => {
        if (!tempReview.trim() || tempRating === 0) return toast.error("Please add review and rating.");

        setLoading(true);
        try {
            const method = review ? "PUT" : "POST";
            const url = review
                ? `${baseUrl}client/reviews/tax-return/${ids.taxReturnId}`
                : `${baseUrl}client/submit-review/${ids.accountantId}`;

            const payload = {
                taxReturnId: ids.taxReturnId,
                rating: tempRating,
                message: tempReview,
            };

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Failed to save review");

            toast.success("Review saved successfully!");

            setReview(tempReview);
            setRating(tempRating);
            setIsEditing(false);
        } catch (err) {
            console.error("Error saving review:", err);
            // toast.error("Error saving review");
        } finally {
            setLoading(false);
        }
    };

    // ✅ Cancel editing
    const handleCancel = () => {
        setIsEditing(false);
    };

    // ✅ Delete review
    const handleDelete = async () => {
        setShowConfirm(false);
        setLoading(true);
        try {
            const res = await fetch(
                `${baseUrl}client/reviews/tax-return/${ids.taxReturnId}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (!res.ok) throw new Error("Failed to delete review");

            toast.success("Review deleted successfully!");

            setReview("");
            setRating(0);
        } catch (err) {
            console.error("Error deleting review:", err);
            // toast.error("Error deleting review");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="taxt_rtn_del_wrapper d-flex align-items-start justify-content-between mt-3">
            <div className="flex-grow-1">
                {isEditing ? (
                    <>
                        <textarea
                            className="form-control mb-2"
                            placeholder="Write your review..."
                            value={tempReview}
                            onChange={(e) => setTempReview(e.target.value)}
                        ></textarea>
                        <Rating
                            style={{ maxWidth: 120 }}
                            itemStyles={{
                                itemShapes: RoundedStar,
                                activeFillColor: "#f59e0b",
                                inactiveFillColor: "#d1d5db",
                            }}
                            value={tempRating}
                            onChange={setTempRating}
                        />
                    </>
                ) : (
                    <>
                        <p className="mb-2">
                            {review?.length > 0 ? review : "Write your review..."}
                        </p>
                        <Rating
                            style={{ maxWidth: 120 }}
                            itemStyles={{
                                itemShapes: RoundedStar,
                                activeFillColor: "#f59e0b",
                                inactiveFillColor: "#d1d5db",
                            }}
                            value={rating}
                            readOnly
                        />
                    </>
                )}
            </div>

            <div className="upload_cntrol gap-2 ms-3">
                {isEditing ? (
                    <>
                        <button
                            className="edit-btn"
                            onClick={handleSave}
                            disabled={loading}
                            title="Save"
                        >
                            {/* {loading ? "Saving..." : "Save"} */}
                            <FaSave />
                        </button>
                        <button title="Cancel" className="del-btn" onClick={handleCancel}>
                            <IoMdCloseCircleOutline />
                        </button>
                    </>
                ) : (
                    <>
                        <button className="edit-btn" title="Edit" onClick={handleEdit}>
                            <MdModeEdit />
                        </button>
                        {review && (
                            <button className="del-btn"
                                onClick={handleDeleteClick}
                                disabled={loading}
                                title="Delete"
                            >
                                <FaRegTrashAlt />
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Confirmation Modal */}
            <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title className="h5">Confirm Deletion</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Are you sure you want to remove the review associated with Tax ID: <strong>{file?.taxReturn?.taxReturnId}</strong>?
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowConfirm(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDelete} disabled={loading}>
                        {loading ? "Deleting..." : "Yes, Remove"}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ReviewBox;