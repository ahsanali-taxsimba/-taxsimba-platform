import React from 'react';
import ManageAccountantPage from './page.client';

interface ManageAccountantProps {
    // title: string;
    // onAddClient: () => void;
}

const ManageAccountant: React.FC<ManageAccountantProps> = (props) => {
    // const { title, onAddClient } = props;
    return (
        <>
        <ManageAccountantPage />
        </>
    );
};


export default ManageAccountant;