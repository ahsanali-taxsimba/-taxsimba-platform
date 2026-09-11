'use client';
import { useEffect, useState } from 'react';
import clientAxios from '@/lib/axios-client';

interface Document {
  id: number;
  name: string;
  type: string;
  description?: string;
  subname?: string;
  options?: { id: number; name: string }[];
}

interface RequiredDocument {
  structureKey: string;
  structureName: string;
  documents: Document[];
}

interface TaxReturnType {
  id: number;
  typeName: string;
  typeCode: string;
  description: string;
  baseFee: string;
  requiredDocuments: RequiredDocument[];
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const TaxReturnPage = () => {
  const [taxReturnTypes, setTaxReturnTypes] = useState<TaxReturnType[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchTaxReturnTypes();
  }, []);

  const fetchTaxReturnTypes = async () => {
    try {
      setLoading(true);
      const res = await clientAxios.post('/admin/tax-return-type', {
        page: 1,
        limit: 100,
        includeDeleted: false,
      });
      setTaxReturnTypes(res.data?.data?.taxReturnTypes || []);
    } catch (error) {
      console.error('Failed to fetch tax return types:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-0">
      <h1 className="text-2xl font-bold mb-4">Tax Return Types</h1>

      {loading ? (
        <p>Loading...</p>
      ) : taxReturnTypes.length === 0 ? (
        <p>No tax return types found.</p>
      ) : (
        <div className="space-y-6">
          {taxReturnTypes.map((type) => (
            <div
              key={type.id}
              className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
            >
              <h2 className="text-xl font-semibold">{type.typeName} ({type.typeCode})</h2>
              <p className="text-gray-600 text-sm mt-1 mb-2">{type.description}</p>

              {type.requiredDocuments.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold text-lg">Required Documents:</h3>
                  <div className="space-y-3 mt-2">
                    {type.requiredDocuments.map((docGroup, idx) => (
                      <div key={idx} className="border border-gray-100 p-3 rounded bg-gray-50">
                        <h4 className="font-semibold text-gray-700">{docGroup.structureName}</h4>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {docGroup.documents.map((doc) => (
                            <li key={doc.id} className="text-sm text-gray-700">
                              <span className="font-medium">{doc.name}</span> – {doc.description || 'No description'}
                              {doc.type === 'checkbox' && doc.options && (
                                <ul className="list-disc list-inside ml-4 text-gray-500">
                                  {doc.options.map((opt) => (
                                    <li key={opt.id}>{opt.name}</li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaxReturnPage;
