import React from 'react';
import ManageClientPage from './page.client';

interface ManageClientProps {
    // title: string;
    // onAddClient: () => void;
}

const ManageClient: React.FC<ManageClientProps> = (props) => {
    // const { title, onAddClient } = props;
    return (
        <>
        <ManageClientPage />
        </>
    );
};


export default ManageClient;