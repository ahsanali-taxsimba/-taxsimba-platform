"use client";
import MyTaxReturn from "@/components/MyTaxReturn";
import emitter from "@/utils/eventBus";
import axios from "axios";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Sidebar from "./_components/Sidebar";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Form, Modal } from "react-bootstrap";
import toast from "react-hot-toast";
import { Logout } from "../lib/api";
import ChangeProfilePassword from "./_components/ChangeProfilePassword";
import DeleteProfile from "./_components/DeleteProfile";
import EditProfile from "./_components/EditProfile";
import MyDocuments from "./_components/MyDocuments";
import TaxTracker from "./_components/taxTracker/TaxTracker";
import { FaEllipsisH, FaEnvelope, FaIdCard, FaPhoneSquareAlt, FaRegImage, FaRegTrashAlt } from "react-icons/fa";
import Dropdown from 'react-bootstrap/Dropdown';
import { MdOutlinePhoneIphone } from "react-icons/md";
import { FaMapLocationDot } from "react-icons/fa6";

import { getBackendBaseUrl } from "@/utils/commonHelper";

export default function DashboardClient({ serverSession }) {
  const { data: session } = useSession()
  const sessionData = session || {}
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['taxTracker', 'editProfile', 'myTaxReturn', 'myDocuments', 'changePassword', 'deleteProfile'];
  const [activeTab, setActiveTab] = useState(
    validTabs.includes(tabFromUrl) ? tabFromUrl : 'taxTracker'
  );

  // Sync activeTab when URL query param changes (e.g. from header dropdown)
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  const [isDocUpdated, setIsDocUpdated] = useState(false);
  const [userData, setUserData] = useState({});
  const [trackUpdate, setTrackUpdate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [taxPrice, setTaxPrice] = useState(120);
  const [isRefresh, setIsRefresh] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const handleImageChange = (e) => {
    setImageFile(e.target.files[0]);
  };

  // API image handler
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

  // Handle image upload
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

  // Fetch user data
  const fetchUserData = async () => {
    setLoading(true);
    if (!sessionData?.accessToken) {
      return;
    }
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
      emitter.emit('user-updated');
      setLoading(false);
    } catch (err) {
      Logout(sessionData);
    }
  };

  const fetchTaxPrice = async () => {
    try {
      const responce = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}client/global-fee`,
        {
          headers: {
            Authorization: `Bearer ${serverSession?.accessToken}`,
          },
        }
      );
      if (responce.data.success) {
        setTaxPrice(parseInt(responce?.data?.data?.globalFee?.baseFee));
      }
    } catch (err) {
      console.error('Error in useEffect:', err);
    }
  }

  useEffect(() => {
    if (sessionData?.accessToken) {
      if (sessionData?.user?.isEngagementLetterAccepted === false) {
        router.push('/engagement-letter');
        return;
      }
      fetchUserData();
    }
    if (isDocUpdated) {
      setIsDocUpdated(false);
    }
    fetchTaxPrice();
  }, [sessionData?.accessToken, trackUpdate, isDocUpdated, isRefresh]);

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
        <div className="profile_head">
          <div className="profile_head_left">
            <figure>

              <Image
                src={
                  userData?.profilePhoto
                    ? userData.profilePhoto.startsWith('https')
                      ? userData.profilePhoto
                      : `${getBackendBaseUrl()}${userData.profilePhoto}`
                    : "/images/user.png"
                }
                onError={() => console.error("Image failed to load")}
                alt="profile image"
                width={200}
                height={200}
              />
            </figure>

          </div>
          <div className="profile_head_right">
            <h2>
              {userData.name
                ? userData.name
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
                <Dropdown.Item href="#/action-1" onClick={handleShow}><FaRegImage className="me-2" /> Update Profile Image</Dropdown.Item>
                <Dropdown.Item className="text-danger" href="#/action-2"

                  data-bs-toggle="modal"
                  data-bs-target="#removeProfileModal"
                  disabled={!userData.profilePhoto}><FaRegTrashAlt className="me-2" />Remove Profile Image</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </div>


        <div className="row mt-4">
          <div className="col-lg-3 mb-4">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
          <div className="col-lg-9">
            {activeTab === 'taxTracker' && (
              <TaxTracker
                serverSession={serverSession}
                setIsDocUpdated={setIsDocUpdated}
                taxPrice={taxPrice}
                setIsRefresh={setIsRefresh}
                isRefresh={isRefresh}
              />
            )}

            {activeTab === 'editProfile' && (
              <EditProfile
                userData={userData}
                sessionData={sessionData}
                setTrackUpdate={setTrackUpdate}
              />
            )}

            {activeTab === 'myTaxReturn' && (
              <MyTaxReturn limit={2} />
            )}

            {activeTab === 'myDocuments' && (
              <MyDocuments
                sessionData={sessionData}
                setTrackUpdate={setTrackUpdate}
              />
            )}

            {activeTab === 'changePassword' && (
              <ChangeProfilePassword
                sessionData={sessionData}
                setTrackUpdate={setTrackUpdate}
              />
            )}

            {activeTab === 'deleteProfile' && (
              <DeleteProfile
                sessionData={sessionData}
                setTrackUpdate={setTrackUpdate}
              />
            )}
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
                  <Button
                    variant="secondary"
                    onClick={handleClose}
                    className="me-2"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary">
                    Submit
                  </Button>
                </div>
              </Form>
            </Modal.Body>
          </Modal>

          {/* Remove Image Modal */}
          <div
            className="modal fade"
            id="removeProfileModal"
            tabIndex="-1"
            aria-labelledby="removeProfileModalLabel"
            aria-hidden="true"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" id="removeProfileModalLabel">
                    Confirm Removal
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  Are you sure you want to remove your profile image?
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      apiImageHandler({ profilePhoto: null });
                    }}
                    data-bs-dismiss="modal"
                  >
                    Yes, Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      </div>
    </section>
  );
}
