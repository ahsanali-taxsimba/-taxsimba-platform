export default function Pcomponent({children,className='',style={}}){
    return (
        <p className={className}>{children}</p>
    )
}