"use client";
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import { Modal, Button, Form } from "react-bootstrap";
import React, { useState } from 'react'
import axios from 'axios';
import toast from 'react-hot-toast';
import { getBackendBaseUrl } from "@/utils/commonHelper";

const ProfileHead = ({ userData }) => {
    const { data: sessionData } = useSession()
    const [show, setShow] = useState(false);
    const [showRemove, setShowRemove] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [trackUpdate, setTrackUpdate] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);
    const handleRemoveClose = () => setShowRemove(false);
    const handleRemoveShow = () => setShowRemove(true);
    const handleImageChange = (e) => {
        setImageFile(e.target.files[0]);
    };
    const handleImageSubmit = async (e) => {
        e.preventDefault();

        if (!imageFile || !imageFile.type.startsWith("image/")) {
            toast.error("Please select a valid image file.");
            return;
        }

        const formData = new FormData();
        formData.append("profilePhoto", imageFile);


        await apiImageHandler(formData);

        setImageFile(null);
        handleClose();
    };
    const apiImageHandler = async (payload) => {
        try {
            const response = await axios.put(
                `${process.env.NEXT_PUBLIC_API_URL}auth/update-account-settings`,
                payload,
                {
                    headers: {
                        Authorization: `Bearer ${sessionData.accessToken}`,
                    },
                }
            );
            if (response.status === 200) {
                toast.success("Image uploaded successfully!");
                setTrackUpdate(!trackUpdate);
            } else {
                toast.error("Failed to upload image. Please try again.");
            }
        } catch (err) {
            toast.error("Failed to upload image. Please try again.");
        }
    };
    return (
        <>
            <div className="profile_head">
                <div className="profile_head_left">
                    <figure>
                        <Image
                            src={
                                userData.profilePhoto
                                    ? `${getBackendBaseUrl()}${userData.profilePhoto}`
                                    : "/images/user.png"
                            }
                            onError={() => console.error("Image failed to load")}
                            alt="profile image"
                            width={250}
                            height={200}
                        />
                    </figure>
                    <div className="profile_img_controller">
                        <button className="basic_btn cean_btn" onClick={handleShow}>
                            <span>
                                <i className="fa-regular fa-pen-to-square" />
                            </span>
                            Update Profile Image
                        </button>
                        <button
                            type="button"
                            className="basic_btn grey_btn"
                            onClick={handleRemoveShow}
                            disabled={!userData.profilePhoto}
                        >
                            <span>
                                <i className="fa-regular fa-trash-can" />
                            </span>
                            Remove Profile Image
                        </button>
                    </div>
                </div>
                <div className="profile_head_right">
                    <h2>
                        {userData.name
                            ? `${userData.name} ${userData.surname || ""}`
                            : sessionData?.user?.firstName !== undefined &&
                            `${sessionData?.user?.firstName} ${sessionData?.user?.lastName}`}
                    </h2>
                    <p>{userData.id ? userData.id : sessionData?.user?.id}</p>
                    <ul>
                        <li>
                            <span>
                                <i className="fa-regular fa-envelope" />
                            </span>
                            {userData.email ? userData.email : sessionData?.user?.email}
                        </li>
                        <li>
                            <span>
                                <i className="fa-solid fa-phone" />
                            </span>
                            {userData.mobile ? userData.mobile : sessionData?.user?.mobile}
                        </li>
                        <li>
                            <span>
                                <i className="fa-solid fa-location-dot" />
                            </span>
                            {userData.street && `${userData.street},`}
                            {userData.city && ` ${userData.city},`}
                            {userData.address && ` ${userData.address},`}
                            {userData.location ? ` ${userData.location}` : "-"}
                        </li>
                    </ul>
                </div>
            </div>
            <>
                {/* Upload Image Modal */}
                <Modal show={show} onHide={handleClose} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>Upload Image</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Form onSubmit={handleImageSubmit}>
                            <Form.Group controlId="formFile">
                                <Form.Label>Select an image file</Form.Label>
                                <Form.Control
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                            </Form.Group>
                            <div className="d-flex justify-content-end mt-3">
                                <button
                                    className="common-bd-btn me-2"
                                    onClick={handleClose}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="common-btn">
                                    Submit
                                </button>
                            </div>
                        </Form>
                    </Modal.Body>
                </Modal>

                {/* Remove Image Modal */}
                <Modal show={showRemove} onHide={handleRemoveClose} centered>
                    <Modal.Header closeButton>
                        <Modal.Title>Confirm Removal</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        Are you sure you want to remove your profile image?
                    </Modal.Body>
                    <Modal.Footer>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleRemoveClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => {
                                apiImageHandler({ profilePhoto: null });
                                handleRemoveClose();
                            }}
                        >
                            Yes, Remove
                        </button>
                    </Modal.Footer>
                </Modal>
            </>
        </>
    )
}

export default ProfileHead
