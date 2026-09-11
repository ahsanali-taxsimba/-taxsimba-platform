import { authOptions } from '@/lib/authOptions';
import { getServerSession } from 'next-auth';
import { notFound } from 'next/navigation';

interface Client {
  id: number;
  name: string;
  surname: string;
  email: string;
}


interface TaxReturn {
  id: number;
  taxReturnId: string;
  taxYear: number;
  status: string;
  client: Client;
  typeName: string;
}

interface FileItem {
  id: number;
  filename: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  fileSize: number;
  mimeType: string;
  uploadStatus: string;
  uploadedAt: string;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  documentType?: string;
  downloadUrl?: string;
}

interface FileCategories {
  [key: string]: {
    [key: string]: FileItem[];
  };
}

interface FilesData {
  totalFiles: number;
  totalSize: number;
  categories: FileCategories;
  allFiles: FileItem[];
}

interface ApiResponse {
  statusCode: number;
  data: {
    taxReturn: TaxReturn;
    files: FilesData;
  };
  message: string;
  success: boolean;
}
interface PageProps {
  params: Promise<{ taxReturnId: string }>;
}
async function fetchTaxReturnData(taxReturnId: string, token: string): Promise<ApiResponse | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/accountant/tax-return/files/${taxReturnId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );
    console.log("response", response)
    if (!response.ok) {
      console.error('❌ API responded with status:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Error fetching tax return data:', error);
    return null;
  }
}

const ManageTaxClientById = async ({ params }: PageProps) => {
  const { taxReturnId } = await params;

  const session = await getServerSession(authOptions);
  if (!session || !session.user?.accessToken) {
    notFound(); // Or redirect to login
  }

  const token = session.user.accessToken;
  const data = await fetchTaxReturnData(taxReturnId, token);

  if (!data || !data.success) {
    notFound();
  }

  const { taxReturn, files } = data.data;
  // Helper function to format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to format category names
  const formatCategoryName = (category: string) => {
    return category.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  // Helper function to format document type names
  const formatDocumentType = (docType: string) => {
    return docType.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Client and Tax Return Information */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex justify-between items-start mb-6 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {taxReturn.client.name} {taxReturn.client.surname}
            </h1>
          </div>
          <div className="text-right">
            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${taxReturn.status === 'assigned'
              ? 'bg-blue-100 text-blue-800'
              : taxReturn.status === 'completed'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
              }`}>
              {taxReturn.status.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Tax Return ID</h3>
            <p className="text-lg font-semibold text-gray-900">{taxReturn.taxReturnId}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Tax Year</h3>
            <p className="text-lg font-semibold text-gray-900">{taxReturn.taxYear}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500">Type</h3>
            <p className="text-lg font-semibold text-gray-900">{taxReturn.typeName}</p>
          </div>
        </div>
      </div>

      {/* Files Summary */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Files Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-600">Total Files</h3>
            <p className="text-2xl font-bold text-blue-900">{files.totalFiles}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-600">Total Size</h3>
            <p className="text-2xl font-bold text-green-900">{formatFileSize(files.totalSize)}</p>
          </div>
        </div>
      </div>

      {/* Files by Category */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Files by Category</h2>
        <div className="space-y-6">
          {Object.entries(files.categories).map(([categoryKey, categoryFiles]) => (
            <div key={categoryKey} className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {formatCategoryName(categoryKey)}
              </h3>

              {Object.entries(categoryFiles).map(([docType, docFiles]) => (
                <div key={docType} className="mb-4 last:mb-0">
                  <h4 className="text-md font-medium text-gray-700 mb-2">
                    {formatDocumentType(docType)}
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Filename</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Size</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Uploaded</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Status</th>
                          <th className="px-4 py-2 text-left text-sm font-semibold text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {docFiles.map((file) => (
                          <tr key={file.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-900">{file.filename}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{formatFileSize(file.fileSize)}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {new Date(file.uploadedAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${file.uploadStatus === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {file.uploadStatus}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <a
                                href={file.cloudinaryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                              >
                                Download
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* All Files Table */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">All Files</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left text-sm font-semibold">Document Type</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Filename</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Size</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Uploaded</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {files.allFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {file.documentType ? formatDocumentType(file.documentType) : '—'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900">{file.filename}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{formatFileSize(file.fileSize)}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${file.uploadStatus === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                      }`}>
                      {file.uploadStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    <a
                      href={file.downloadUrl || file.cloudinaryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManageTaxClientById;