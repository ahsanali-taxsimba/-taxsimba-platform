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
            qualification: getFormData?.qualification || "",
            experience: getFormData?.experience || ""
        }));
    }, [formType]);
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
        setFormData({
            name: "",
            surname: "",
            email: "",
            mobile: "",
            qualification: "",
            experience: ""
        })
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

        // Mobile validation regex (allows numbers, spaces, +, -, (), but must contain at least 10 digits)
        const mobileRegex = /^[\d\s\+\-\(\)]+$/;
        const digitCount = value.replace(/\D/g, '').length;
        if (eventName !== "qualification" &&
            eventName !== "experience"
        ) {
            if (value.trim() === "") {
                setFormDataError((prev) => ({
                    ...prev,
                    [eventName]: `${eventName} is required`
                }));
            }
            else if (eventName === "email") {
                // Email format validation
                if (!emailRegex.test(value)) {
                    setFormDataError((prev) => ({
                        ...prev,
                        [eventName]: "Please enter a valid email address"
                    }));
                } else {
                    setFormDataError((prev) => ({
                        ...prev,
                        [eventName]: null
                    }));
                }
            } else if (eventName === "mobile") {
                // Mobile number validation
                if (!mobileRegex.test(value)) {
                    setFormDataError((prev) => ({
                        ...prev,
                        [eventName]: "Mobile number can only contain digits, spaces, +, -, and parentheses"
                    }));
                } else if (digitCount < 10) {
                    setFormDataError((prev) => ({
                        ...prev,
                        [eventName]: "Mobile number must contain at least 10 digits"
                    }));
                } else {
                    setFormDataError((prev) => ({
                        ...prev,
                        [eventName]: null
                    }));
                }
            } else {
                // For name and surname - just check if not empty
                setFormDataError((prev) => ({
                    ...prev,
                    [eventName]: null
                }));
            }
        }
        setFormData((prev) => ({
            ...prev,
            [eventName]: value
        }));
    };
    const { data: session } = useSession()
    const handleSubmit = async () => {
        const form = new FormData();
        try {
            console.log("asdf")
            if (formType == "add") {
                const response = await clientAxios.post(`/admin/accountants/create`, formData, true)
                console.log("console", response.data)
                if (response) {
                    fetchData()
                    setGridUpdate(!gridUpdate)
                }
            } else {
                const response = await clientAxios.put(`/admin/accountants/update/${getFormData?.id}`, formData, true)
                console.log("console", response.data)
                if (response) {
                    fetchData()
                    setGridUpdate(!gridUpdate)
                }
            }
        } catch (err) {
            console.error(err)
        }
        handleCloseModal();
    };
    return (
        <>
            {
                formType == "add" ?
                    <Button size="sm" className="w-full sm:w-auto" onClick={openModal} startIcon={<PlusIcon />} >
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
                className="max-w-[584px] p-5 lg:p-10"
            >
                <div className="">
                    <h4 className="mb-6 text-lg font-medium text-gray-800 dark:text-white/90 text-left">
                        Personal Information
                    </h4>

                    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                        <div className="col-span-1">
                            <Label>First Name</Label>
                            <Input type="text" placeholder="Emirhan" name="name" defaultValue={formData?.name} hint={formDataError?.name} error={formDataError?.name ? true : false} onChange={handleInputChange} />
                        </div>

                        <div className="col-span-1">
                            <Label>Last Name</Label>
                            <Input type="text" placeholder="Boruch" name="surname" defaultValue={formData?.surname} hint={formDataError?.surname} error={formDataError?.surname ? true : false} onChange={handleInputChange} />
                        </div>

                        <div className="col-span-1">
                            <Label>Email</Label>
                            <Input type="email" placeholder="emirhanboruch55@gmail.com" name="email" defaultValue={formData?.email} hint={formDataError?.email} error={formDataError?.email ? true : false} onChange={handleInputChange} />
                        </div>

                        <div className="col-span-1">
                            <Label>Phone</Label>
                            <Input type="text" placeholder="+09 363 398 46" name="mobile" defaultValue={formData?.mobile} hint={formDataError?.mobile} error={formDataError?.mobile ? true : false} onChange={handleInputChange} />
                        </div>

                        <div className="col-span-1">
                            <Label>Qualification</Label>
                            <Input type="text" placeholder="Your Degree" name="qualification" defaultValue={formData?.qualification} onChange={handleInputChange} />
                        </div>

                        <div className="col-span-1">
                            <Label>Experience</Label>
                            <Input type="text" placeholder="Your Experience" name="experience" defaultValue={formData?.experience} onChange={handleInputChange} />
                        </div>
                    </div>

                    <div className="flex items-center justify-end w-full gap-3 mt-6">
                        <Button size="sm" variant="outline" onClick={handleCloseModal}>
                            Close
                        </Button>
                        <Button size="sm" onClick={handleSubmit}>
                            {formType == "add" ? `Add` : `Save Changes`}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
