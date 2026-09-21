"use client";
import React, { useEffect, useState } from "react";
import { useModal } from "@/hooks/useModal";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import Label from "@/components/form/Label";
import Input from "@/components/form/input/InputField";
import { PencilIcon, PlusIcon } from "@/icons";
import clientAxios from "@/lib/axios-client";
import Badge from "@/components/ui/badge/Badge";
import { toast } from "react-toastify";

type FormDataKeys = "name" | "surname" | "email" | "mobile" | "qualification" | "experience";

const FIELD_LABELS: Record<FormDataKeys, string> = {
    name: "First Name",
    surname: "Last Name",
    email: "Email",
    mobile: "Phone",
    qualification: "Qualification",
    experience: "Experience",
};

export default function FormAddEditModal(props: any) {
    const { formType = "add", getFormData, fetchData, gridUpdate, setGridUpdate } = props;
    const { isOpen, openModal, closeModal } = useModal();
    const [formData, setFormData] = useState({
        name: "",
        surname: "",
        email: "",
        mobile: "",
        qualification: "",
        experience: "",
    });
    useEffect(() => {
        setFormData(() => ({
            name: getFormData?.name || "",
            surname: getFormData?.surname || "",
            email: getFormData?.email || "",
            mobile: getFormData?.mobile || getFormData?.phone || "",
            qualification:
                getFormData?.Accountant?.qualification || getFormData?.qualification || "",
            experience: getFormData?.Accountant?.experience || getFormData?.experience || "",
        }));
    }, [formType, getFormData]);

    const [formDataError, setFormDataError] = useState<Record<FormDataKeys, string | null>>({
        name: null,
        surname: null,
        email: null,
        mobile: null,
        qualification: null,
        experience: null,
    });

    const handleCloseModal = () => {
        closeModal();
        if (formType == "add") {
            setFormData({
                name: "",
                surname: "",
                email: "",
                mobile: "",
                qualification: "",
                experience: "",
            });
        }
        setFormDataError({
            name: null,
            surname: null,
            email: null,
            mobile: null,
            qualification: null,
            experience: null,
        });
    };

    const validateField = (eventName: FormDataKeys, value: string): string | null => {
        const label = FIELD_LABELS[eventName];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const mobileRegex = /^[\d\s+\-()]+$/;
        const digitCount = value.replace(/\D/g, "").length;

        if (value.trim() === "") {
            if (
                eventName === "name" ||
                eventName === "surname" ||
                eventName === "email" ||
                eventName === "mobile"
            ) {
                return `${label} is required`;
            }
            return null;
        }
        if (eventName === "email" && !emailRegex.test(value)) {
            return "Please enter a valid email address";
        }
        if (eventName === "mobile") {
            if (!mobileRegex.test(value)) {
                return "Phone can only contain digits, spaces, +, -, and parentheses";
            }
            if (digitCount < 7 || digitCount > 15) {
                return "Phone must contain 7–15 digits";
            }
            if (value.length > 20) {
                return "Phone must be at most 20 characters";
            }
        }
        if (eventName === "qualification") {
            if (value.trim().length < 2 || value.trim().length > 120) {
                return "Qualification must be between 2 and 120 characters";
            }
        }
        if (eventName === "experience") {
            const asNum = Number(value);
            if (!Number.isFinite(asNum) || asNum < 0 || asNum > 60) {
                return "Experience must be a number of years between 0 and 60";
            }
        }
        return null;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name: eventName, value } = e.target;
        const key = eventName as FormDataKeys;
        setFormDataError((prev) => ({
            ...prev,
            [key]: validateField(key, value),
        }));
        setFormData((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        const newErrors: Record<FormDataKeys, string | null> = {
            name: validateField("name", formData.name),
            surname: validateField("surname", formData.surname),
            email: validateField("email", formData.email),
            mobile: validateField("mobile", formData.mobile),
            qualification: formData.qualification
                ? validateField("qualification", formData.qualification)
                : null,
            experience: formData.experience
                ? validateField("experience", formData.experience)
                : null,
        };
        const hasError = Object.values(newErrors).some(Boolean);
        if (hasError) {
            setFormDataError(newErrors);
            setLoading(false);
            toast.error("Please correct the highlighted fields.");
            return;
        }

        try {
            let response;
            const payload = {
                name: formData.name.trim(),
                surname: formData.surname.trim(),
                email: formData.email.trim(),
                mobile: formData.mobile.trim(),
                phone: formData.mobile.trim(),
                qualification: formData.qualification.trim(),
                experience: formData.experience.trim(),
            };
            if (formType == "add") {
                response = await clientAxios.post(`/admin/accountants/create`, payload, true);
            } else {
                response = await clientAxios.put(
                    `/admin/accountants/update/${getFormData?.id}`,
                    payload,
                    true,
                );
            }

            if (!response?.data?.success) {
                toast.error(response?.data?.message || "Failed to save accountant.");
                return;
            }

            const saved = response.data?.data ?? {};
            const missing: string[] = [];
            if (payload.surname && !saved.surname && formType === "add") missing.push("Last Name");
            if (payload.mobile && !(saved.mobile || saved.phone)) missing.push("Phone");
            if (payload.qualification && !(saved.qualification || saved.Accountant?.qualification)) {
                missing.push("Qualification");
            }
            if (payload.experience && !(saved.experience || saved.Accountant?.experience)) {
                missing.push("Experience");
            }
            if (missing.length) {
                toast.error(
                    `Save incomplete — these fields were not persisted: ${missing.join(", ")}`,
                );
                return;
            }

            handleCloseModal();
            toast.success(
                response.data?.message ||
                    (formType === "add"
                        ? "Accountant added successfully."
                        : "Accountant details updated successfully."),
            );

            if (typeof fetchData === "function") {
                try {
                    fetchData();
                } catch (e) {
                    console.error("Fetch Data Error:", e);
                }
            }
            if (typeof setGridUpdate === "function") {
                try {
                    setGridUpdate(!gridUpdate);
                } catch (e) {
                    console.error("Grid Update Error:", e);
                }
            }
        } catch (err: any) {
            console.error("API Error:", err);
            const errorResponse = err.response?.data;
            if (errorResponse?.error?.details && Array.isArray(errorResponse.error.details)) {
                const mapped: any = {};
                errorResponse.error.details.forEach((detail: any) => {
                    if (detail.field) mapped[detail.field] = detail.message;
                });
                setFormDataError((prev) => ({ ...prev, ...mapped }));
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
            {formType == "add" ? (
                <Button
                    size="sm"
                    className="refresh-btn bg-green w-full sm:w-auto"
                    onClick={openModal}
                    startIcon={<PlusIcon />}
                >
                    Add Accountant
                </Button>
            ) : (
                <Badge
                    variant="light"
                    color="primary"
                    startIcon={<PencilIcon />}
                    onClick={openModal}
                    dynamicClassName={"cursor-pointer"}
                >
                    Edit
                </Badge>
            )}
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
                            <Label className="text-left">
                                First Name <span className="text-error-500">*</span>
                            </Label>
                            <Input
                                type="text"
                                placeholder="Emirhan"
                                name="name"
                                defaultValue={formData?.name}
                                hint={formDataError?.name}
                                error={!!formDataError?.name}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="col-span-1">
                            <Label className="text-left">
                                Last Name <span className="text-error-500">*</span>
                            </Label>
                            <Input
                                type="text"
                                placeholder="Boruch"
                                name="surname"
                                defaultValue={formData?.surname}
                                hint={formDataError?.surname}
                                error={!!formDataError?.surname}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="col-span-1">
                            <Label className="text-left">
                                Email <span className="text-error-500">*</span>
                            </Label>
                            <Input
                                type="email"
                                placeholder="emirhanboruch55@gmail.com"
                                name="email"
                                defaultValue={formData?.email}
                                hint={formDataError?.email}
                                error={!!formDataError?.email}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="col-span-1">
                            <Label className="text-left">
                                Phone <span className="text-error-500">*</span>
                            </Label>
                            <Input
                                type="text"
                                placeholder="+09 363 398 46"
                                name="mobile"
                                defaultValue={formData?.mobile}
                                hint={formDataError?.mobile}
                                error={!!formDataError?.mobile}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="col-span-1">
                            <Label className="text-left">Qualification</Label>
                            <Input
                                type="text"
                                placeholder="Your Degree"
                                name="qualification"
                                defaultValue={formData?.qualification}
                                hint={formDataError?.qualification}
                                error={!!formDataError?.qualification}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="col-span-1">
                            <Label className="text-left">Experience</Label>
                            <Input
                                type="text"
                                placeholder="Years of experience"
                                name="experience"
                                defaultValue={formData?.experience}
                                hint={formDataError?.experience}
                                error={!!formDataError?.experience}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end w-full gap-3 mt-10">
                        <Button
                            size="sm"
                            variant="outline"
                            className="!rounded-2xl !px-6"
                            onClick={handleCloseModal}
                        >
                            Close
                        </Button>
                        <Button
                            size="sm"
                            disabled={loading}
                            className="!px-6 !bg-[#37a267] hover:!bg-[#37a267]/90 !rounded-2xl border-none"
                            onClick={handleSubmit}
                        >
                            {loading
                                ? "Processing..."
                                : formType == "add"
                                  ? `Add`
                                  : `Save Changes`}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
