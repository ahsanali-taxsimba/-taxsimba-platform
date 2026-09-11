// app/tax-return/page.js
'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import toast from 'react-hot-toast';
import PaymentModal from './_component/PaymentModal';
import PaymentStatusChecker from './_component/PaymentStatusChecker';
import { Col, Container, Row } from 'react-bootstrap';
import { FaAnglesLeft } from 'react-icons/fa6';

export default function TaxReturnPage() {
  const { data: session } = useSession();
  const [taxReturnTypes, setTaxReturnTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [requiredDocuments, setRequiredDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({});
  const [formErrors, setFormErrors] = useState({});
  // Determine the fiscal start year for UK (April to March)
  const today = new Date();
  const fiscalStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  const [financialYear, setFinancialYear] = useState(`${fiscalStartYear}-${fiscalStartYear + 1}`);
  const [selectedAddressProof, setSelectedAddressProof] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [createdTaxReturn, setCreatedTaxReturn] = useState(null);
  const [showPaymentStatus, setShowPaymentStatus] = useState(false);
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const [taxPrice, setTaxPrice] = useState(120);
  const [showDocuments, setShowDocuments] = useState(false);
  const accessToken = session?.accessToken;
  let hasRenderedTaxReturnHeader = false;
  // Generate the last 10 fiscal year options, newest first
  const financialYearOptions = Array.from({ length: 10 }, (_, i) => {
    const start = fiscalStartYear - i;
    return `${start}-${start + 1}`;
  });

  useEffect(() => {
    if (accessToken) {
      fetchTaxReturnTypes();
      fetchTaxPrice();
    }
  }, [accessToken]);

  const fetchTaxPrice = async () => {
    try {
      const responce = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}client/global-fee`,
        {
          headers: {
            Authorization: accessToken,
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

  const fetchTaxReturnTypes = async () => {
    try {
      setLoading(true);

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}client/tax-return-type`,
        {
          limit: 100,
          page: 1
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: session?.accessToken
          },
        }
      );

      if (response.data.success) {
        setTaxReturnTypes(response.data.data.taxReturnTypes);
      } else {
        console.error('Unexpected response structure:', response.data);
      }

    } catch (error) {
      console.error('Error fetching tax return types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (e) => {
    const typeId = e.target.value;
    setSelectedType(typeId);

    if (typeId) {
      const selectedTypeData = taxReturnTypes.find(type => type.id == typeId);
      if (selectedTypeData) {
        setRequiredDocuments(selectedTypeData.requiredDocuments || []);
      }
    } else {
      setRequiredDocuments([]);
    }

    if (typeId && financialYear) {
      setShowDocuments(true);
    }

    // Reset form data when type changes
    setFormData({});
    setSelectedAddressProof('');
    // Reset payment states
    setCreatedTaxReturn(null);
    setShowPaymentModal(false);
    setShowPaymentStatus(false);
    setSubmissionComplete(false);
  };

  const handleInputChange = (fieldName, value, type = 'text') => {
    const updatedFormData = {
      ...formData,
      [fieldName]: type === 'file' ? value.target.files[0] : value
    };

    const updatedErrors = { ...formErrors };

    // Remove error if value is valid
    if (updatedErrors[fieldName]) {
      if (type === 'file' && value?.target?.files?.[0]) {
        delete updatedErrors[fieldName];
      } else if (
        (type === 'text' || type === 'number' || type === 'textarea' || type === 'checkbox') &&
        value?.toString().trim()
      ) {
        delete updatedErrors[fieldName];
      }
    }

    setFormData(updatedFormData);
    setFormErrors(updatedErrors);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const errors = {};

    // Validate required fields
    requiredDocuments.forEach(section => {
      const { structureKey, documents } = section;

      // Skip additional_info as it's optional
      // if (structureKey === 'additional_info') return;

      // Special handling for address proof
      // if (structureKey === 'address_proof') {
      //   if (!selectedAddressProof) {
      //     errors['address_proof_selection'] = 'Please select one address proof document.';
      //     return;
      //   }

      //   // Validate the selected address proof document
      //   const selectedDoc = documents.find(doc => doc.id == selectedAddressProof);
      //   if (selectedDoc && selectedDoc.fieldName) {
      //     const value = formData[selectedDoc.fieldName];
      //     if (selectedDoc.type === 'file' && !value) {
      //       errors[selectedDoc.fieldName] = 'Please upload the selected address proof document.';
      //     }
      //   }
      //   return;
      // }

      // Validate other required documents
      // documents.forEach(document => {
      //   const { fieldName, type } = document;

      //   if (!fieldName) return; // Skip if no fieldName

      //   const value = formData[fieldName];

      //   if (
      //     (type === 'text' || type === 'number' || type === 'textarea') &&
      //     !value?.toString().trim()
      //   ) {
      //     errors[fieldName] = 'This field is required.';
      //   }

      //   if (type === 'file' && !value) {
      //     errors[fieldName] = 'Please upload a document.';
      //   }

      //   if (type === 'checkbox' && !value) {
      //     errors[fieldName] = 'Please make a selection.';
      //   }
      // });
    });

    // Validate financial year
    if (!financialYear) {
      errors['financialYear'] = 'Please select a financial year.';
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error('Please fix the validation errors before proceeding.');
      return;
    }

    // Create tax return and show payment modal
    await createTaxReturn();
  };

  const createTaxReturn = async () => {
    try {
      setLoading(true);

      // Prepare FormData for submission
      const payload = new FormData();

      // Add basic fields
      payload.append('taxReturnTypeId', selectedType);
      payload.append('financialYear', financialYear);
      const taxYear = parseInt(financialYear?.split('-')?.[0], 10);
      if (!Number.isNaN(taxYear)) {
        payload.append('taxYear', taxYear);
      }
      payload.append('priority', 'medium');
      payload.append('isUkResident', true);
      payload.append('numberOfDaysInUk', 365);
      payload.append('studentLoanType', 'none');

      // Add form data - both files and text fields
      Object.entries(formData).forEach(([fieldName, value]) => {
        if (value instanceof File) {
          payload.append(fieldName, value);
        } else if (value !== null && value !== undefined && value !== '') {
          payload.append(fieldName, value);
        }
      });


      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}client/apply-tax-return`,
        payload,
        {
          headers: {
            Authorization: session?.accessToken,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.status === 201) {

        const selectedTypeData = taxReturnTypes.find(type => type.id == selectedType);

        // Set created tax return data for payment modal
        setCreatedTaxReturn({
          id: response.data.data.taxReturn.id,
          taxReturnId: response.data.data.taxReturn.taxReturnId,
          typeName: selectedTypeData.typeName,
          totalFee: response.data.data.taxReturn.totalFee || selectedTypeData.baseFee
        });

        // Show payment modal
        // setShowPaymentModal(true);

        // Bypassing payment modal for now
        setSubmissionComplete(true);
        toast.success("Tax return submitted successfully.");
      }
    } catch (err) {
      console.error('❌ Error creating tax return:', err);

      if (err.response?.status === 422 && err.response?.data?.errors) {
        const errors = err.response.data.errors;
        errors.forEach((e) => {
          const msg = e?.message || 'Validation failed';
          toast.error(msg);
        });
      } else {
        toast.error('Failed to create tax return. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };


  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    // Show payment status since tax return is created
    setShowPaymentStatus(true);
  };

  const resetForm = () => {
    setFormData({});
    setSelectedType('');
    setSelectedAddressProof('');
    setFinancialYear('');
    setRequiredDocuments([]);
    setCreatedTaxReturn(null);
    setShowPaymentStatus(false);
    setSubmissionComplete(false);
    setFormErrors({});
    setShowDocuments(false);
  };

  const handlePaymentStatusUpdate = (statusData) => {

    // If payment is completed, you can update UI accordingly
    if (statusData.taxReturn.paymentStatus === 'completed') {
      setSubmissionComplete(true);
      setShowPaymentModal(false);

      // Show payment status checker
      setShowPaymentStatus(true);
      setSubmissionComplete(true);

      // toast.success('Payment completed successfully! Your tax return has been submitted.');
    }
  };

  const renderDocumentField = (document, structureKey) => {
    const { id, name, type, description, options, subname, fieldName } = document;
    const error = formErrors[fieldName];

    if (!fieldName) {
      console.warn(`No fieldName for document ${name} in ${structureKey}`);
      return null;
    }

    switch (type) {
      case 'file':
        return (
          <div key={fieldName} className="global_upload_box">
            <label>
              {subname || name}
              {description && <span> - {description}</span>}
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => handleInputChange(fieldName, e, 'file')}
              className={`form-control ${error ? 'is-invalid' : ''}`}
            />
            {error && <div className="invalid-feedback d-block">{error}</div>}
          </div>
        );

      case 'text':
        return (
          <div key={fieldName} className="global_upload_box">
            <label>{name}
              {description && <span> - {description}</span>}
            </label>
            <input
              type="text"
              placeholder={description || "Enter value"}
              value={formData[fieldName] || ''}
              onChange={(e) => handleInputChange(fieldName, e.target.value, 'text')}
              className={`form-control ${error ? 'is-invalid' : ''}`}
            />
            {error && <div className="invalid-feedback d-block">{error}</div>}
          </div>
        );

      case 'number':
        return (
          <div key={fieldName} className="global_upload_box">
            <label>{name}
              {description && <span> - {description}</span>}
            </label>
            <input
              type="number"
              placeholder={description || "Enter amount"}
              value={formData[fieldName] || ''}
              onChange={(e) => handleInputChange(fieldName, e.target.value, 'number')}
              className={`form-control ${error ? 'is-invalid' : ''}`}
            />
            {error && <div className="invalid-feedback d-block">{error}</div>}
          </div>
        );

      case 'textarea':
        return (
          <div key={fieldName} className="global_upload_box">
            <label>{name}</label>
            <textarea
              placeholder="Describe here..."
              value={formData[fieldName] || ''}
              onChange={(e) => handleInputChange(fieldName, e.target.value, 'textarea')}
              className={`form-control ${error ? 'is-invalid' : ''}`}
              rows="4"
            />
            {error && <div className="invalid-feedback d-block">{error}</div>}
          </div>
        );

      case 'checkbox':
        return (
          <div key={fieldName} className="global_upload_box">
            <label>{name}</label>
            <div className="rdo_holder">
              {options?.map(option => (
                <label key={option.id} className="cl-radio">
                  <input
                    type="radio"
                    name={fieldName}
                    value={option.name}
                    checked={formData[fieldName] === option.name}
                    onChange={(e) => handleInputChange(fieldName, e.target.value, 'checkbox')}
                  />
                  <span>{option.name}</span>
                </label>
              ))}
            </div>
            {error && <div className="invalid-feedback d-block">{error}</div>}
          </div>
        );

      default:
        return null;
    }
  };

  const selectedTypeData = taxReturnTypes.find(type => type.id == selectedType);

  return (
    <>
      <section className="tax_retur_ban" style={{ backgroundImage: "url(/images/banner-bg-img.png)" }}>
        <div className="container">
          <h1>Tax Return</h1>
        </div>
      </section>


      <section className="tax_return_main tax-return-sec">
        <div className="container">
          <Row>
            <Col md={10} className="mx-auto">
              {submissionComplete && (
                <div className="row mb-5 justify-content-center">
                  <div className="col-md-10 col-lg-8">
                    <div className="success-submission-card text-center p-5 rounded-4 shadow-sm bg-white border" style={{ transition: 'all 0.3s ease' }}>
                      <div className="success-icon-wrapper mb-4 d-inline-flex align-items-center justify-content-center rounded-circle shadow-sm" style={{ width: '90px', height: '90px', backgroundColor: '#eafaf1' }}>
                        <svg width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="#37a267" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <h2 className="mb-3 fw-bold" style={{ color: '#1f2937' }}>Submission Complete!</h2>
                      <p className="text-muted mb-5 fs-5">
                        Your documents have been securely received. A dedicated TaxSimba Accountant will be assigned to your file shortly to ensure maximum accuracy and fast processing.
                      </p>
                      <button
                        className="common-btn py-3 px-5 fw-bold d-inline-flex align-items-center justify-content-center gap-2"
                        onClick={resetForm}
                        style={{ borderRadius: '50px', fontSize: '1.1rem', backgroundColor: '#37a267', color: 'white' }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="16"></line>
                          <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                        Submit Another Tax Return
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Hide form if submission is complete, unless user clicks to reset */}

              {!submissionComplete && (
                <form className='common-form' onSubmit={handleSubmit}>
                  {!showDocuments && (
                    <div className="tax_return_global_box">

                      <h2>Basic Details</h2>
                      <div className="basic_tax_return">
                        <div className="basic_row">
                          <label>Type of Tax Return</label>
                          <select
                            className="form-select"
                            value={selectedType}
                            onChange={handleTypeChange}
                            disabled={loading}
                          >
                            <option value="">Select the type</option>
                            {taxReturnTypes.map(type => (
                              <option key={type.id} value={type.id}>
                                {type.typeName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="basic_row">
                          <label>Financial Year</label>
                          <select
                            className={`form-select ${formErrors['financialYear'] ? 'is-invalid' : ''}`}
                            value={financialYear}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFinancialYear(val);
                              if (val && selectedType) {
                                setShowDocuments(true);
                              }
                            }}
                          >
                            <option value="">Select financial year</option>
                            {financialYearOptions.map((yearRange) => (
                              <option key={yearRange} value={yearRange}>
                                {yearRange}
                              </option>
                            ))}
                          </select>
                          {formErrors['financialYear'] && (
                            <div className="invalid-feedback d-block">{formErrors['financialYear']}</div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {showDocuments && selectedType && financialYear && selectedTypeData && (
                    <div className="tax_return_global_box">
                      <button
                        type="button"
                        className='form-back-btn mb-3'
                        title='Back'
                        onClick={() => setShowDocuments(false)}
                      >
                        <FaAnglesLeft />
                      </button>

                      <div className="selected_details_summary mb-4 p-3 bg-light rounded border">
                        <div className="row">
                          <div className="col-md-6">
                            <p className="mb-0"><strong>Type of Tax Return:</strong> {selectedTypeData?.typeName}</p>
                          </div>
                          <div className="col-md-6">
                            <p className="mb-0"><strong>Financial Year:</strong> {financialYear}</p>
                          </div>
                        </div>
                      </div>

                      <h2>Upload Documents</h2>

                      {requiredDocuments
                        .sort((a, b) => {
                          if (a.structureKey === 'address_proof') return -1;
                          if (b.structureKey === 'address_proof') return 1;
                          return 0;
                        })
                        .map(documentStructure => {
                          const { structureKey, structureName, documents } = documentStructure;

                          // === Address Proof Section ===
                          if (structureKey === 'address_proof') {
                            return (
                              <div key={structureKey} className="sub_block">
                                <div className="tax_rtn_subheading mb-3">
                                  <h5>{structureName}</h5>
                                </div>
                                <div className="row">
                                  <div className="col-md-12">
                                    <select
                                      className={`form-select ${formErrors['address_proof_selection'] ? 'is-invalid' : ''}`}
                                      value={selectedAddressProof}
                                      onChange={(e) => {
                                        setSelectedAddressProof(e.target.value);
                                        if (formErrors['address_proof_selection']) {
                                          setFormErrors(prev => {
                                            const newErrors = { ...prev };
                                            delete newErrors['address_proof_selection'];
                                            return newErrors;
                                          });
                                        }
                                      }}
                                    >
                                      <option value="">Select Address Proof</option>
                                      {documents.map(doc => (
                                        <option key={doc.id} value={doc.id}>{doc.name}</option>
                                      ))}
                                    </select>
                                    {formErrors['address_proof_selection'] && (
                                      <div className="invalid-feedback d-block">{formErrors['address_proof_selection']}</div>
                                    )}
                                  </div>

                                  {documents
                                    .filter(doc => doc.id == selectedAddressProof)
                                    .map(doc => (
                                      <div className="col-md-6" key={`address_proof_${doc.id}`}>
                                        {renderDocumentField(doc, structureKey)}
                                      </div>
                                    ))}
                                </div>
                              </div>
                            );
                          }

                          // === Additional Info Section ===
                          const isAdditionalInfo = structureKey === 'additional_info';
                          const fileDoc = isAdditionalInfo ? documents.find(doc => doc.type === 'file') : null;
                          const textDoc = isAdditionalInfo ? documents.find(doc => doc.type === 'textarea') : null;

                          // === Standard & Additional Info inside shared block ===
                          const block = (
                            <div key={structureKey} className="sub_block">
                              {!hasRenderedTaxReturnHeader && (
                                <div className="tax_rtn_subheading">
                                  <h4>Upload Tax Return Information</h4>
                                  <p>Please upload or provide the following information where applicable&nbsp;</p>
                                </div>
                              )}
                              {hasRenderedTaxReturnHeader = true}

                              <div className="inner_sub_block">
                                <h5>{structureName}</h5>
                              </div>

                              <div className="row">
                                {isAdditionalInfo ? (
                                  <div className="col-md-12">
                                    <div className="global_upload_box">
                                      {fileDoc && (
                                        <>
                                          <label>
                                            {fileDoc.name}
                                            {fileDoc.description && <span> - {fileDoc.description}</span>}
                                          </label>
                                          <button type="button" className="border_btn upload_btn">
                                            <input
                                              type="file"
                                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                              onChange={(e) => handleInputChange(fileDoc.fieldName, e, 'file')}
                                            />
                                            <span>
                                              <img src="/images/upload.png" alt="" />
                                            </span>
                                            Upload Document
                                          </button>
                                        </>
                                      )}
                                      {textDoc && (
                                        <textarea
                                          placeholder="Describe here..."
                                          value={formData[textDoc.fieldName] || ''}
                                          onChange={(e) => handleInputChange(textDoc.fieldName, e.target.value, 'textarea')}
                                          className="form-control mt-3"
                                        />
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  documents.map(document => (
                                    <div key={document.fieldName || `${structureKey}_${document.id}`} className="col-md-6">
                                      {renderDocumentField(document, structureKey)}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          );

                          return block;
                        })}

                      <div className="tax_return_file_btn">
                        <button type="submit" className="common-btn w-100 mb-2" disabled={loading}>
                          {loading ? ' Processing...' : ' Create Tax Return'}
                        </button>
                        <p className='text-center'>
                          After creating your tax return, you'll be prompted to complete the payment securely.
                        </p>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </Col>
          </Row>

        </div>
      </section>
    </>
  );
}
