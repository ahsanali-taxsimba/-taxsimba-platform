"use client";
import { useState, useEffect } from "react";
import { useFetchMyFilesData } from "@/hooks/fetchData";
import Image from "next/image";
import { handleDownload } from "@/app/lib/downloadFiles";
import { FaAngleDown, FaAngleUp } from "react-icons/fa";
import { getFileIcon } from "@/utils/commonHelper";


const MyDocuments = ({ sessionData, setTrackUpdate }) => {
  const [userFiles, setUserFiles] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const filesToDisplay = showAll ? userFiles : userFiles.slice(0, 10);

  const handleShowAllToggle = () => {
    setShowAll(!showAll);
  };
  const clientFilesHandler = async () => {
    const token = sessionData?.accessToken;
    const apiResponse = await useFetchMyFilesData(token);
    if (apiResponse?.success && apiResponse?.data?.files?.documents?.length > 0) {
      setUserFiles(apiResponse?.data?.files?.documents);
    } else {
      // Use dummy data if no documents returned (e.g., backend not accessible)
      setUserFiles([]);
    }
  };

  useEffect(() => {
    clientFilesHandler();
  }, [sessionData]);

  return (
    <>
      <div className="edt_profile_box">
        <div className="edt_prof_head">
          <h3>My Documents</h3>
          <p>Your Financial Documents</p>
        </div>
        <div className="upload_box_wrapper">
          {filesToDisplay?.length > 0 &&
            filesToDisplay?.map((file, index) => {
              const fileIcon = getFileIcon(file);
              return (
                <div className="upload_pdf"
                  key={index}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleDownload(file.downloadUrl || file.previewUrl, file.filename)}
                >
                  <div className="top_upload_img">
                    <Image
                      src={fileIcon}
                      width={100}
                      height={100}
                      alt=""
                      style={{ height: "100%", width: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div className="upload_label">
                    <label>{file.filename}</label>
                  </div>
                </div>
              );
            })}
          {userFiles.length > 10 && (
            <div className="upload_pdf show-all-container">
              <button onClick={handleShowAllToggle} className="show-all-button">
                {showAll ?
                  <>
                    <span className="bounce-up">
                      <FaAngleUp />
                    </span>
                    Show Less</> :
                  <>
                    Show All
                    <span className="bounce-down">
                      <FaAngleDown />
                    </span></>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MyDocuments;
