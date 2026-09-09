"use client";
import emitter from "@/utils/eventBus";
import axios from "axios";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Sidebar from "./Sidebar";
import { useEffect, useRef, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { getBackendBaseUrl } from "@/utils/commonHelper";
import toast from "react-hot-toast";
import { Logout } from "../../lib/api";
import Dropdown from "react-bootstrap/Dropdown";
import {
    FaCloudUploadAlt,
    FaEllipsisH,
    FaEnvelope,
    FaIdCard,
    FaPhoneSquareAlt,
    FaRegImage,
    FaRegTrashAlt,
} from "react-icons/fa";
import { FaMapLocationDot } from "react-icons/fa6";

export default function DashboardLayoutClient({ serverSession, children }) {
    const { data: session } = useSession();
    const sessionData = session || {};

    const [userData, setUserData] = useState({});
    const [trackUpdate, setTrackUpdate] = useState(false);
    const [loading, setLoading] = useState(true);
    const [show, setShow] = useState(false);
    const [showRemove, setShowRemove] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);

    const handleClose = () => {
        setShow(false);
        setImageFile(null);
        setImagePreview(null);
    };
    const handleShow = () => setShow(true);

    const handleRemoveClose = () => setShowRemove(false);
    const handleRemoveShow = () => setShowRemove(true);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
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
                if (!response?.data?.data?.profilePhoto) {
                    toast.success("Image removed successfully!");
                    setTrackUpdate(!trackUpdate);
                } else if (response?.data?.data?.profilePhoto) {
                    toast.success("Image uploaded successfully!");
                    setTrackUpdate(!trackUpdate);
                }
            } else {
                toast.error("Failed to upload image. Please try again.");
            }
        } catch (err) {
            toast.error("Failed to upload image. Please try again.");
        }
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

    const fetchUserData = async () => {
        setLoading(true);
        if (!sessionData?.accessToken) return;
        try {
            const res = await axios.post(
                `${process.env.NEXT_PUBLIC_API_URL}auth/get-account-details`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${sessionData.accessToken}`,
                    },
                }
            );
            setUserData(res?.data?.data);
            emitter.emit("user-updated");
            setLoading(false);
        } catch (err) {
            Logout(sessionData);
        }
    };

    useEffect(() => {
        if (sessionData?.accessToken) {
            fetchUserData();
        }
    }, [sessionData?.accessToken, trackUpdate]);

    if (loading) {
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
    }

    return (
        <section className="profile_page">
            <div className="container">
                {/* Profile Header */}
                <div className="profile_head">
                    <div className="profile_head_left">
                        <figure>
                            <Image
                                src={
                                    userData?.profilePhoto
                                        ? userData.profilePhoto.startsWith("https")
                                            ? userData.profilePhoto
                                            : `${getBackendBaseUrl()}${userData.profilePhoto}`
                                        : "/images/user.png"
                                }
                                onError={() => console.error("Image failed to load")}
                                alt="profile image"
                                width={220}
                                height={200}
                            />
                        </figure>
                    </div>
                    <div className="profile_head_right">
                        <h2>
                            {userData.name
                                ? `${userData.name} ${userData.surname || ""}`
                                : sessionData?.user?.firstName !== undefined &&
                                `${sessionData?.user?.firstName} ${sessionData?.user?.lastName}`}
                        </h2>
                        <ul className="ps-0">
                            <li>
                                <FaIdCard />
                                {userData.id ? userData.id : sessionData?.user?.id}
                            </li>
                            <li>
                                <FaEnvelope />
                                {userData.email ? userData.email : sessionData?.user?.email}
                            </li>
                            <li>
                                <FaPhoneSquareAlt />
                                {userData.mobile ? userData.mobile : sessionData?.user?.mobile}
                            </li>
                            <li>
                                <FaMapLocationDot />
                                {userData.street && `${userData.street},`}
                                {userData.city && ` ${userData.city},`}
                                {userData.address && ` ${userData.address},`}
                                {userData.location ? ` ${userData.location}` : "-"}
                            </li>
                        </ul>
                    </div>
                    <div className="ellipse_dopdown common-drop">
                        <Dropdown>
                            <Dropdown.Toggle id="dropdown-basic">
                                <FaEllipsisH className="text-muted" />
                            </Dropdown.Toggle>
                            <Dropdown.Menu>
                                <Dropdown.Item href="#/action-1" onClick={handleShow}>
                                    <FaRegImage className="me-2" /> Update Profile Image
                                </Dropdown.Item>
                                <Dropdown.Item
                                    className="text-danger"
                                    onClick={handleRemoveShow}
                                    disabled={!userData.profilePhoto}
                                >
                                    <FaRegTrashAlt className="me-2" />
                                    Remove Profile Image
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown>
                    </div>
                </div>

                {/* Sidebar + Page Content */}
                <div className="row mt-4">
                    <div className="col-lg-3 mb-4 d-lg-block d-none">
                        <Sidebar />
                    </div>
                    <div className="col-lg-9">{children}</div>
                </div>

                {/* Modals */}
                <>
                    <Modal show={show} onHide={handleClose} centered>
                        <Modal.Header closeButton>
                            <Modal.Title>Upload Image</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            <Form onSubmit={handleImageSubmit}>

                                <div
                                    className="upload-drop-zone"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        style={{ display: "none" }}
                                    />
                                    {imagePreview ? (
                                        <div className="upload-preview">
                                            <img src={imagePreview} alt="Preview" />
                                            <p className="upload-filename">{imageFile?.name}</p>
                                        </div>
                                    ) : (
                                        <div className="upload-placeholder">
                                            <FaCloudUploadAlt className="upload-icon" />
                                            <p className="upload-text">Click to upload an image</p>
                                            <span className="upload-hint">JPG, PNG, GIF — Max 5MB</span>
                                        </div>
                                    )}
                                </div>

                                <div className="d-flex justify-content-end gap-2 mt-3">
                                    <button
                                        className="red-bd-btn"
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
                                className="red-bd-btn"
                                onClick={handleRemoveClose}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="common-btn px-3"
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
            </div>
        </section>
    );
}
