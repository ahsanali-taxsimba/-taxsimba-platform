"use client";
import React, { useEffect, useState } from "react";
import { useModal } from "@/hooks/useModal";
import ComponentCard from "@/components/common/ComponentCard";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { PencilIcon, PlusIcon } from "@/icons";
import { useSession } from "next-auth/react";
import axiosInstance from "@/lib/axiosInstance";
import axios from "axios";
import clientAxios from "@/lib/axios-client";
import Badge from "@/components/ui/badge/Badge";
import { toast } from "react-toastify";

type FormDataKeys = "name" | "surname" | "email" | "mobile" | "qualification" | "experience";

export default function FormAddEditModal(props: any) {
    const { formType = "add", getFormData, fetchData, gridUpdate, setGridUpdate } = props;
    const { isOpen, openModal, closeModal } = useModal();
    const [formData, setFormData] = useState({
        name: "",
        surname: "",
        email: "",
        mobile: "",
        qualification: "",
        experience: ""
    });
    useEffect(() => {
        setFormData(() => ({
            name: getFormData?.name || "",
            surname: getFormData?.surname || "",
            email: getFormData?.email || "",
            mobile: getFormData?.mobile || "",
            qualification: getFormData?.Accountant?.qualification || getFormData?.qualification || "",
            experience: getFormData?.Accountant?.experience || getFormData?.experience || ""
        }));
    }, [formType, getFormData]);
    console.log("formType211", { formType, getFormData, formData })
    const [formDataError, setFormDataError] = useState<{
        name: string | null;
        surname: string | null;
        email: string | null;
        mobile: string | null;
        qualification: string | null;
        experience: string | null;
    }>({
        name: null,
        surname: null,
        email: null,
        mobile: null,
        qualification: null,
        experience: null
    });
    const handleCloseModal = () => {
        closeModal()
        if (formType == "add") {
            setFormData({
                name: "",
                surname: "",
                email: "",
                mobile: "",
                qualification: "",
                experience: ""
            })
        }
        setFormDataError({
            name: null,
            surname: null,
            email: null,
            mobile: null,
            qualification: null,
            experience: null
        })
    }
    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { name: eventName, value } = e.target;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const mobileRegex = /^[\d\s\+\-\(\)]+$/;
        const digitCount = value.replace(/\D/g, '').length;

        let error: string | null = null;

        if (value.trim() === "") {
            // surname is mandatory only in edit/update mode
            const isMandatory = (eventName === "name" || eventName === "surname" || eventName === "email" || eventName === "mobile");

            if (isMandatory) {
                error = `${eventName} is required`;
            }
        } else if (eventName === "email") {
            if (!emailRegex.test(value)) {
                error = "Please enter a valid email address";
            }
        } else if (eventName === "mobile") {
            if (!mobileRegex.test(value)) {
                error = "Mobile number can only contain digits, spaces, +, -, and parentheses";
            } else if (digitCount < 10) {
                error = "Mobile number must contain at least 10 digits";
            }
        }

        setFormDataError((prev) => ({
            ...prev,
            [eventName]: error
        }));

        setFormData((prev) => ({
            ...prev,
            [eventName]: value
        }));
    };
    const { data: session } = useSession()
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        // Reset errors before submission
        setFormDataError({
            name: null,
            surname: null,
            email: null,
            mobile: null,
            qualification: null,
            experience: null
        });

        let hasError = false;
        const newErrors: any = {
            name: null,
            surname: null,
            email: null,
            mobile: null,
            qualification: null,
            experience: null
        };

        if (!formData.name?.trim()) { newErrors.name = "name is required"; hasError = true; }
        if (!formData.surname?.trim()) { newErrors.surname = "surname is required"; hasError = true; }

        if (!formData.email?.trim()) {
            newErrors.email = "email is required";
            hasError = true;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = "Please enter a valid email address";
            hasError = true;
        }

        if (!formData.mobile?.trim()) {
            newErrors.mobile = "mobile is required";
            hasError = true;
        } else {
            const digitCount = formData.mobile.replace(/\D/g, '').length;
            if (!/^[\d\s\+\-\(\)]+$/.test(formData.mobile)) {
                newErrors.mobile = "Mobile number can only contain digits, spaces, +, -, and parentheses";
                hasError = true;
            } else if (digitCount < 10) {
                newErrors.mobile = "Mobile number must contain at least 10 digits";
                hasError = true;
            }
        }

        if (hasError) {
            setFormDataError(newErrors);
            setLoading(false);
            return;
        }

        try {
            let response;
            if (formType == "add") {
                response = await clientAxios.post(`/admin/accountants/create`, formData, true)
            } else {
                response = await clientAxios.put(`/admin/accountants/update/${getFormData?.id}`, formData, true)
            }

            if (response) {
                handleCloseModal();
                toast.success(response.data?.message || (formType === "add" ? "Accountant added successfully" : "Accountant updated successfully"));

                // Safely refresh background data
                if (typeof fetchData === "function") {
                    try { fetchData(); } catch (e) { console.error("Fetch Data Error:", e); }
                }
                if (typeof setGridUpdate === "function") {
                    try { setGridUpdate(!gridUpdate); } catch (e) { console.error("Grid Update Error:", e); }
                }
            }
        } catch (err: any) {
            console.error("API Error:", err);
            const errorResponse = err.response?.data;

            if (errorResponse?.error?.details && Array.isArray(errorResponse.error.details)) {
                const newErrors: any = {};
                errorResponse.error.details.forEach((detail: any) => {
                    if (detail.field) {
                        newErrors[detail.field] = detail.message;
                    }
                });
                setFormDataError((prev) => ({
                    ...prev,
                    ...newErrors
                }));
                toast.error(errorResponse.message || "Validation failed");
            } else if (errorResponse?.message) {
                toast.error(errorResponse.message);
            } else {
                toast.error("Something went wrong. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };
    return (
        <>
            {
                formType == "add" ?
                    <Button size="sm" className="refresh-btn bg-green w-full sm:w-auto" onClick={openModal} startIcon={<PlusIcon />} >
                        Add Accountant
                    </Button>
                    :
                    <Badge variant="light" color="primary" startIcon={<PencilIcon />} onClick={openModal} dynamicClassName={"cursor-pointer"}>
                        Edit
                    </Badge>
            }
            <Modal
                isOpen={isOpen}
                onClose={handleCloseModal}
                className="max-w-[584px] p-5 lg:p-10 z-1000"
            >
                <div className="">
                    <h4 className="mb-6 text-xl font-bold text-gray-800 dark:text-white/90 text-start">
                        {formType === "add" ? "Add Accountant" : "Update Accountant"}
                    </h4>

                    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 mt-8 text-start">
                        <div className="col-span-1">
                            <Label className="text-left">First Name <span className="text-error-500">*</span></Label>
                            <Input type="text" placeholder="Emirhan" name="name" defaultValue={formData?.name} hint={formDataError?.name} error={formDataError?.name ? true : false} onChange={handleInputChange} />
                        </div>

                        <div className="col-span-1">
                            <Label className="text-left">Last Name <span className="text-error-500">*</span></Label>
                            <Input type="text" placeholder="Boruch" name="surname" defaultValue={formData?.surname} hint={formDataError?.surname} error={formDataError?.surname ? true : false} onChange={handleInputChange} />
                        </div>

                        <div className="col-span-1">
                            <Label className="text-left">Email <span className="text-error-500">*</span></Label>
                            <Input type="email" placeholder="emirhanboruch55@gmail.com" name="email" defaultValue={formData?.email} hint={formDataError?.email} error={formDataError?.email ? true : false} onChange={handleInputChange} />
                        </div>

                        <div className="col-span-1">
                            <Label className="text-left">Phone <span className="text-error-500">*</span></Label>
                            <Input type="text" placeholder="+09 363 398 46" name="mobile" defaultValue={formData?.mobile} hint={formDataError?.mobile} error={formDataError?.mobile ? true : false} onChange={handleInputChange} />
                        </div>

                        <div className="col-span-1">
                            <Label className="text-left">Qualification</Label>
                            <Input type="text" placeholder="Your Degree" name="qualification" defaultValue={formData?.qualification} hint={formDataError?.qualification} error={formDataError?.qualification ? true : false} onChange={handleInputChange} />
                        </div>

                        <div className="col-span-1">
                            <Label className="text-left">Experience</Label>
                            <Input type="text" placeholder="Your Experience" name="experience" defaultValue={formData?.experience} hint={formDataError?.experience} error={formDataError?.experience ? true : false} onChange={handleInputChange} />
                        </div>
                    </div>

                    <div className="flex items-center justify-end w-full gap-3 mt-10">
                        <Button size="sm" variant="outline" className="!rounded-2xl !px-6" onClick={handleCloseModal}>
                            Close
                        </Button>
                        <Button size="sm" disabled={loading} className="!px-6 !bg-[#37a267] hover:!bg-[#37a267]/90 !rounded-2xl border-none" onClick={handleSubmit}>
                            {loading ? "Processing..." : (formType == "add" ? `Add` : `Save Changes`)}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
