export default function RegistrationLoginLayout({ children }) {
    return (
        <div className="registration_login_full" >
            <div className="container-fluid">
                <div className="auth-inr-box registration_part_inner">
                    {children}
                </div>
            </div>
        </div>
    )
}