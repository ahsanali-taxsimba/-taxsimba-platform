import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleCheck, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import {TranslatedInput} from '../TranslatedContent';
export default function TextInputField({ type = "text", ...props }) {
  const shouldShowPasswordValidation =
    props.name === "password" && props.value.length > 0 && props.spanErrors;

  return (
    <div className="form_row">
      <TranslatedInput
        type={type}
        name={props.name}
        value={props.value}
        onChange={props.handleFunction}
        className={props.className}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        required
      />
      {props.name === "password" && (
        <span className="toggle_password hide_password">{props.eyeIcon}</span>
      )}
      {props.name === "confirmPassword" && (
        <span className="toggle_password hide_password">{props.eyeIcon}</span>
      )}
      {props.err && <span className="error_msg error_msg_color">{props.err}</span>}

      {shouldShowPasswordValidation && (
        <span className="error_msg">
          <ul>
            {props.spanErrors.errMsg.map((item, index) => {
              const isValid = props.validError?.[item.id];
              return (
                <li key={index} >
                  <FontAwesomeIcon icon={isValid ? faCircleCheck : faTimesCircle} className={isValid ? "success" : "error"}/> {item.msg}
                </li>
              );
            })}
          </ul>
        </span>
      )}
    </div>
  );
}
