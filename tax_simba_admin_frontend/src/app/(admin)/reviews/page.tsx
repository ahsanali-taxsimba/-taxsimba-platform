"use client";

import React, { useEffect, useState } from 'react';
import type { JSX } from 'react';
import {
  Star,
  MessageSquare,
  Send,
  Calendar,
  TrendingUp,
  Search,

} from 'lucide-react';
import { useSession } from 'next-auth/react';
import clientAxios from '@/lib/axios-client';
import Badge from '@/components/ui/badge/Badge';
import { toast } from 'react-toastify';
import { isAdminRole, isAccountantRole } from '@/lib/roles';

type Review = {
  id: number;
  client: {
    name: string;
    image?: string;
    profileImage?: string;
  } | null;
  accountant?: {
    name: string;
    image?: string;
  } | null;
  taxReturn?: {
    taxReturnId: string;
  } | null;
  rating: number;
  message: string;
  createdAt: string;
  status: number; // 1 = approved, 0 = rejected
  rejectionReason?: string;
  response?: string;
};

const ReviewsPage = () => {
  const { data } = useSession();
  const userData = data?.user;
  console.log("userData", userData)
  const isAdmin = isAdminRole(userData?.role);
  const isAccountant = isAccountantRole(userData?.role);

  const [activeTab, setActiveTab] = useState('reviews');
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [reviewResponse, setReviewResponse] = useState('');
  const [filterRating, setFilterRating] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedReviewForReject, setSelectedReviewForReject] = useState<Review | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [approving, setApproving] = useState(false);

  // Fetch reviews based on user role
  const fetchReviews = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const endpoint = isAdmin ? '/admin/get-all-reviews' : '/accountant/get-all-reviews';
      const response = await clientAxios.get(endpoint);

      if (response.data.success) {
        setReviews(response.data.data);
      } else {
        console.error('Failed to fetch reviews:', response.data.message);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [userData]);

  // Admin function to handle review approval/rejection
  const handleReviewAction = async (action: string, reviewData: Review | null = null) => {
    if (!isAdmin) return; // Only admins can manage reviews

    const review = reviewData || selectedReviewForReject;

    if (!review) {
      toast.error('No review selected.');
      return;
    }

    if (action === 'reject' && !rejectReason.trim()) {
      toast.error('Please provide a reason for rejecting the review.');
      return;
    }

    const isRejecting = action === 'reject';
    const isApproving = action === 'approve';

    if (isRejecting) setRejecting(true);
    if (isApproving) setApproving(true);

    try {
      const requestData: { action: string; reason?: string } = { action };
      if (action === 'reject') {
        requestData.reason = rejectReason;
      }

      const response = await clientAxios.post(`/admin/manage-review/${review.id}`, requestData);

      if (response.data.success) {
        // Refresh the reviews data
        await fetchReviews(false);

        // Close modals and reset states
        if (isRejecting) {
          setShowRejectModal(false);
          setSelectedReviewForReject(null);
          setRejectReason('');
        }

        toast.success(`Review ${action}ed successfully.`);
      } else {
        toast.error(`Failed to ${action} review: ` + (response.data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(`Error ${action}ing review:`, err);
      toast.error(`Error ${action}ing review. Please try again.`);
    } finally {
      if (isRejecting) setRejecting(false);
      if (isApproving) setApproving(false);
    }
  };

  // Functions to open modals
  const openRejectModal = (review: any) => {
    setSelectedReviewForReject(review);
    setShowRejectModal(true);
  };

  // Filter reviews based on selected filters
  const filteredReviews = reviews.filter(review => {
    const matchesRating = filterRating === 'all' || review.rating.toString() === filterRating;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'approved' && review.status === 1) ||
      (filterStatus === 'rejected' && review.status === 0);
    const matchesSearch = searchTerm === '' ||
      review.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.taxReturn?.taxReturnId?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesRating && matchesStatus && matchesSearch;
  });

  // Calculate stats
  const totalReviews = reviews.length;
  const approvedReviews = reviews.filter(r => r.status === 1).length;
  const rejectedReviews = reviews.filter(r => r.status === 0).length;
  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const handleReviewResponse = (review: any) => {
    setSelectedReview(review);
    setReviewResponse(review.response || '');
    setShowResponseModal(true);
  };

  const handleSubmitResponse = () => {
    console.log('Submitting response:', reviewResponse);
    setShowResponseModal(false);
    // In real implementation, update the review with response
  };

  interface RenderStarsProps {
    rating: number;
    size?: string;
  }

  const renderStars = (rating: number, size: string = 'text-lg'): JSX.Element[] => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`${size} ${index < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900">Loading Reviews...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap lg:flex-nowrap justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isAdmin ? 'Reviews Management' : 'My Reviews & Profile'}
              </h1>
              <p className="text-gray-600 mt-1">
                {isAdmin ? 'Manage all client reviews across the platform' : 'View your client reviews and professional profile'}
              </p>
            </div>
            <div className="flex flex-wrap lg:flex-nowrap gap-2 items-center space-x-4">
              <div className="flex items-center space-x-2 bg-yellow-50 px-4 py-2 rounded-lg">
                <Star className="h-5 w-5 text-yellow-500 fill-current" />
                <span className="font-semibold text-yellow-800">{averageRating}</span>
                <span className="text-yellow-600">({totalReviews} reviews)</span>
              </div>
              {isAdmin && (
                <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg">
                  <span className="text-sm font-medium text-blue-800">
                    {approvedReviews} Approved • {rejectedReviews} Rejected
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {['reviews', 'analytics'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-3 border-b-2 font-medium text-sm capitalize ${activeTab === tab
                    ? 'border-[#37a267] text-[#37a267]'
                    : 'border-transparent text-gray-500 hover:text-[#37a267] hover:border-[#37a267]'
                    }`}
                >
                  {tab === 'reviews' ? 'Client Reviews' : 'Analytics'}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {/* Filters and Search */}
                <div className="flex flex-wrap lg:flex-nowrap gap-2 flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                  <div className="flex flex-wrap lg:flex-nowrap gap-2 items-center space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search reviews..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <select
                      value={filterRating}
                      onChange={(e) => setFilterRating(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Ratings</option>
                      <option value="5">5 Stars</option>
                      <option value="4">4 Stars</option>
                      <option value="3">3 Stars</option>
                      <option value="2">2 Stars</option>
                      <option value="1">1 Star</option>
                    </select>
                  </div>

                  <div className="text-sm text-gray-600">
                    Showing {filteredReviews.length} of {totalReviews} reviews
                  </div>
                </div>

                {/* Reviews List */}
                <div className="space-y-6">
                  {filteredReviews.map((review) => (
                    <div key={review.id} className={`bg-white border rounded-xl p-6 hover:shadow-md transition-shadow ${review.status === 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'
                      }`}>
                      {/* Review Header */}
                      <div className="flex flex-wrap lg:flex-nowrap justify-between items-start mb-4">
                        <div className="flex  flex-wrap lg:flex-nowrap gap-2 items-center space-x-4">
                          <div className="w-12 h-12 min-w-12 rounded-full flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
                            {(review.client?.image || review.client?.profileImage) ? (
                              <img
                                src={(review.client.image || review.client.profileImage)?.startsWith('http')
                                  ? (review.client.image || review.client.profileImage)
                                  : `${process.env.NEXT_PUBLIC_API_URL}${review.client.image || review.client.profileImage}`
                                }
                                alt={review.client?.name || 'Client'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                                <span className="font-semibold text-blue-800">
                                  {review.client?.name ? review.client.name[0].toUpperCase() : 'C'}
                                </span>
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {review.client?.name || 'Anonymous Client'}
                            </h4>
                            <div className="flex flex-wrap lg:flex-nowrap gap-2 items-center space-x-2 text-sm text-gray-500">
                              <span>{review.taxReturn?.taxReturnId || 'N/A'}</span>
                              {isAdmin && (
                                <>
                                  <span>•</span>
                                  <span>Accountant: {review.accountant?.name || 'N/A'}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap lg:flex-nowrap gap-2 items-center space-x-3">
                          <div className="flex flex-wrap lg:flex-nowrap items-center space-x-1">
                            {renderStars(review.rating, 'w-4 h-4')}
                            <span className="text-sm font-bold text-yellow-700 ml-1">{review.rating.toFixed(1)}</span>
                          </div>
                          <Badge
                            color={review.status === 0 ? "error" : "success"}
                            size="sm"
                          >
                            {review.status === 0 ? 'Rejected' : 'Approved'}
                          </Badge>
                        </div>
                      </div>

                      {/* Review Content */}
                      <div className="mb-4">
                        <p className="text-gray-700 leading-relaxed">{review.message}</p>
                      </div>

                      {/* Display rejection reason if rejected */}
                      {review.status === 0 && review.rejectionReason && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-200 rounded-lg">
                          <p className="text-sm font-medium text-red-800 mb-1">Rejection Reason:</p>
                          <p className="text-sm text-red-700">{review.rejectionReason}</p>
                        </div>
                      )}

                      {/* Review Actions */}
                      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          {review.status === 0 && (
                            <span className="text-xs text-red-600">
                              Hidden from public view
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">

                          {isAdmin && (
                            <div className="flex space-x-2">
                              {review.status === 1 ? (
                                // If approved, show reject button
                                <button
                                  onClick={() => openRejectModal(review)}
                                  className="text-red-600 hover:text-red-800 text-sm font-medium transition-colors flex items-center space-x-1"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  <span>Reject</span>
                                </button>
                              ) : (
                                // If rejected, show approve button
                                <button
                                  onClick={() => handleReviewAction('approve', review)}
                                  disabled={approving}
                                  className="text-green-600 hover:text-green-800 text-sm font-medium transition-colors flex items-center space-x-1 disabled:opacity-50"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span>{approving ? 'Approving...' : 'Approve'}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredReviews.length === 0 && (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No reviews found</h3>
                    <p className="text-gray-500">Try adjusting your filters or search terms.</p>
                  </div>
                )}
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-8">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100">Average Rating</p>
                        <p className="text-3xl font-bold">{averageRating}</p>
                      </div>
                      <Star className="h-8 w-8 text-blue-200" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100">Total Reviews</p>
                        <p className="text-3xl font-bold">{totalReviews}</p>
                      </div>
                      <MessageSquare className="h-8 w-8 text-green-200" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100">Approved Reviews</p>
                        <p className="text-3xl font-bold">{approvedReviews}</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-purple-200" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-100">Rejected Reviews</p>
                        <p className="text-3xl font-bold">{rejectedReviews}</p>
                      </div>
                      <Calendar className="h-8 w-8 text-orange-200" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Reject Modal */}
      {isAdmin && showRejectModal && selectedReviewForReject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-9999">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <svg className="w-6 h-6 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900">Reject Review</h3>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">
                    {selectedReviewForReject.client?.name || `Client`}
                  </h4>
                  <div className="flex">{renderStars(selectedReviewForReject.rating, 'w-4 h-4')}</div>
                </div>
                <p className="text-gray-700 text-sm mb-2">{selectedReviewForReject.message}</p>
                <p className="text-xs text-gray-500">
                  {new Date(selectedReviewForReject.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-red-500 focus:border-red-500 text-sm"
                    placeholder="Please provide a reason for rejecting this review..."
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs text-yellow-800">
                    <strong>Note:</strong> Rejecting this review will hide it from public view. You can approve it later if needed.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setSelectedReviewForReject(null);
                    setRejectReason('');
                  }}
                  disabled={rejecting}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReviewAction('reject')}
                  disabled={rejecting || !rejectReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2 transition-colors disabled:opacity-50"
                >
                  {rejecting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Rejecting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Reject Review</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Response Modal for Accountants */}
      {isAccountant && showResponseModal && selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-9999">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Respond to Review</h3>

              <div className="bg-gray-50 rounded-lg p-6 mb-6 border">
                <div className="flex items-start space-x-4 mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="font-semibold text-blue-800">
                      {selectedReview.client?.name ? selectedReview.client.name[0].toUpperCase() : 'C'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{selectedReview.client?.name || 'Client'}</h4>
                      <div className="flex items-center space-x-1">
                        {renderStars(selectedReview.rating, 'w-4 h-4')}
                        <span className="text-sm text-gray-600 ml-1">({selectedReview.rating}/5)</span>
                      </div>
                    </div>
                    <p className="text-gray-700 mb-2">{selectedReview.message}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your Response</label>
                  <textarea
                    value={reviewResponse}
                    onChange={(e) => setReviewResponse(e.target.value)}
                    rows={8}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Write a professional response to address the client's feedback..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t">
                <button
                  onClick={() => setShowResponseModal(false)}
                  className="px-6 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitResponse}
                  disabled={!reviewResponse.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  <Send className="h-4 w-4" />
                  <span>Submit Response</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsPage;