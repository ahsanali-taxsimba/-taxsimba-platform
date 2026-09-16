import { Award, Star, MessageSquare, TrendingUp } from 'lucide-react';

interface PerformanceMetricsProps {
  profileData: {
    completedReturns: number;
    averageRating: number;
    totalReviews: number;
    responseRate: number;
  };
}

export default function PerformanceMetrics({ profileData }: PerformanceMetricsProps) {
  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">Performance Metrics</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <Award className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <h4 className="text-lg font-semibold text-green-800">Completed Returns</h4>
          <p className="text-3xl font-bold text-green-600">{profileData.completedReturns.toLocaleString()}</p>
        </div>
        <div className="text-center p-4 bg-yellow-50 rounded-lg">
          <Star className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <h4 className="text-lg font-semibold text-yellow-800">Average Rating</h4>
          <p className="text-3xl font-bold text-yellow-600">{profileData.averageRating}/5</p>
        </div>
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <MessageSquare className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <h4 className="text-lg font-semibold text-blue-800">Total Reviews</h4>
          <p className="text-3xl font-bold text-blue-600">{profileData.totalReviews}</p>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <h4 className="text-lg font-semibold text-purple-800">Response Rate</h4>
          <p className="text-3xl font-bold text-purple-600">{profileData.responseRate}%</p>
        </div>
      </div>
    </div>
  );
}