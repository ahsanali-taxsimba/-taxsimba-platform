import { FaCheck } from "react-icons/fa";

const TaxFillingTracker = ({ session }) => {
  return (
    <>
      <div className="tracker">
        <div className="tracker_heading">
          <h2>Tax Tracker</h2>
          <p>You can view the status of your tax return file</p>
        </div>
        <div className="tax_rtn_reg">
          <p>
            <strong>Tax Return Year 2025-2026</strong>
          </p>
          <p>Reg. No. 34u234ydjjf</p>
        </div>
        <div className="total_progress">
          {/* Progress Line */}
          <div className="progress-line">
            <div className="progress-fill" />
            <div className="steps-dots">
              <div className="dot completed" />
              <div className="dot completed" />
              <div className="dot active"> <FaCheck /> </div>
              <div className="dot" />
            </div>
          </div>
          {/* Step Boxes */}
          <div className="step-boxes">
            <div className="step-box completed">
              <div className="icon">
                <i className="fa-regular fa-user" />
              </div>
              <div>
                Accounted
                <br />
                assign
              </div>
            </div>
            <div className="step-box completed">
              <div className="icon">
                <i className="fa-regular fa-user" />
              </div>
              <div>
                Preparation
                <br />
                started
              </div>
            </div>
            <div className="step-box active">
              <div className="icon">
                <i className="fa-regular fa-user" />
              </div>
              <div>
                Work In Progress
                <br />
                draft ready
              </div>
            </div>
            <div className="step-box inactive">
              <div className="icon">
                <i className="fa-regular fa-user" />
              </div>
              <div>
                Final
                <br />
                submission
              </div>
            </div>
          </div>
        </div>
        <div className="upload_valid">
          <p>
            <span>
              <i className="fa-solid fa-circle-info" />
            </span>
            Your address proof was rejected. Please upload a valid document.
          </p>
          <button className="border_btn upload_btn">
            <input type="file" />
            <span>
              <img src="/images/upload.png" alt="" />
            </span>
            Upload Document
          </button>
        </div>
      </div>
    </>
  );
};

export default TaxFillingTracker;
